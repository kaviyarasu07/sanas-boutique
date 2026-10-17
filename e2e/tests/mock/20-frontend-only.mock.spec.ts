import { expect, test, type Page } from '@playwright/test'

/**
 * Frontend-only checks: the backend is replaced by canned responses (page.route), so these run with just
 * `npm run dev` in frontend/ and need no database. They were executed during the review; the two tests
 * tagged BUG-xx FAIL on the current code on purpose and turn green once the bug is fixed.
 */
const isApi = (url: URL) => url.pathname.startsWith('/api/')
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const DUE_MOBILE = '9876543210'

async function mockApi(page: Page, calls: string[] = []) {
  await page.route(isApi, async (route) => {
    const u = new URL(route.request().url()); const p = u.pathname.replace(/^\/api\//, '')
    calls.push(`${route.request().method()} ${p}${u.search}`)
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    if (p === 'auth/setup-status') return json({ adminExists: true })
    if (p === 'auth/login') return json({ accessToken: 'tok', username: 'o', fullName: 'Outlet O', role: 'OUTLET' })
    if (p === 'outlet/me/bookings/due') return json(u.searchParams.get('mobile') === DUE_MOBILE ? [{ id: 1, kind: 'APPOINTMENT', status: 'BOOKED', customerName: 'Due', customerMobile: DUE_MOBILE, startDate: today(), startTime: '09:00:00', expectedReturnDate: null, items: [{ itemId: 1, name: 'Facial', itemCode: 'X1', serviceName: 'Parlour', unitPrice: 200, quantity: 1 }], estimatedAmount: 200, bill: null, challan: null }] : [])
    if (p === 'outlet/me/bills/customers' || p === 'outlet/me/bills/recent') return json([])
    if (p.startsWith('outlet/me')) return json(/(day|overdue|upcoming)$/.test(p) ? [] : { content: [], page: 0, size: 50, totalPages: 0, totalElements: 0, today: { total: 0, bills: 0, services: [] }, month: { total: 0, bills: 0, services: [] }, topOutletsToday: [], topOutletsMonth: [] })
    return json({})
  })
}

async function signInAsOutlet(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Mobile number or username').fill('outlet')
  await page.getByLabel('Password', { exact: true }).fill('secret')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/outlet$/)
}

test('anonymous users are redirected to /login from protected routes; unknown URL goes home', async ({ page }) => {
  await mockApi(page)
  for (const p of ['/dashboard', '/dashboard/outlets', '/outlet', '/outlet/billing', '/outlet/bookings', '/outlet/stitching']) {
    await page.goto(p)
    await expect(page, p).toHaveURL(/\/login$/)
  }
  await page.goto('/nope')
  await expect(page).toHaveURL(/\/$/)
})

test('login form validates empty fields', async ({ page }) => {
  await mockApi(page)
  await page.goto('/login')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByText('Enter your username')).toBeVisible()
  await expect(page.getByText('Enter your password')).toBeVisible()
})

test('BUG-01: typing a 10-digit mobile in the bill form loads that customer’s due pre-bookings', async ({ page }) => {
  const calls: string[] = []
  await mockApi(page, calls)
  await signInAsOutlet(page)
  await page.goto('/outlet/billing')
  await page.getByRole('button', { name: 'Create new bill' }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Customer mobile').fill(DUE_MOBILE)
  await expect.poll(() => calls.filter((c) => c.includes('bookings/due')).length, { message: 'GET outlet/me/bookings/due should be called' }).toBeGreaterThan(0)
  await expect(dialog.getByText('Pre-booked for')).toBeVisible()
})

test('BUG-02: when the server answers 401 (expired session) the app sends the user to /login', async ({ page }) => {
  await page.route(isApi, (r) => new URL(r.request().url()).pathname.endsWith('setup-status')
    ? r.fulfill({ status: 200, contentType: 'application/json', body: '{"adminExists":true}' })
    : r.fulfill({ status: 401, contentType: 'application/json', body: '{"message":"Token expired"}' }))
  await page.goto('/login')
  await page.evaluate(() => { localStorage.setItem('accessToken', 'expired'); localStorage.setItem('role', 'OUTLET') })
  await page.goto('/outlet/billing')
  await expect(page).toHaveURL(/\/login$/, { timeout: 10_000 })
  expect(await page.evaluate(() => localStorage.getItem('role')), 'role must be cleared together with the token').toBeNull()
})

test('BUG-05: a signed-in outlet user opening an admin URL is sent to their own home, not the login form', async ({ page }) => {
  await mockApi(page)
  await signInAsOutlet(page)
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/outlet$/)
})
