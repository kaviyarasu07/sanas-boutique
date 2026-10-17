import { expect, test } from '@playwright/test'
import { adminApi, ADMIN_PASSWORD, ADMIN_USERNAME, outletWithStock } from '../helpers'

test('login page shows an error for wrong credentials and stays put', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Mobile number or username').fill('nobody')
  await page.getByLabel('Password', { exact: true }).fill('wrong-password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByText('Could not sign in')).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)
})

test('login form validates empty fields', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByText('Enter your username')).toBeVisible()
  await expect(page.getByText('Enter your password')).toBeVisible()
})

test('admin logs in and lands on the dashboard; sign out returns home and blocks the dashboard', async ({ page }) => {
  test.skip(!ADMIN_USERNAME, 'set ADMIN_USERNAME / ADMIN_PASSWORD')
  await page.goto('/login')
  await page.getByLabel('Mobile number or username').fill(ADMIN_USERNAME)
  await page.getByLabel('Password', { exact: true }).fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.getByText('Sign out', { exact: false }).first().click()
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login$/)
})

test('route guards: anonymous users are sent to login from every protected route', async ({ page }) => {
  for (const path of ['/dashboard', '/dashboard/outlets', '/dashboard/reports', '/outlet', '/outlet/billing', '/outlet/bookings', '/outlet/stitching']) {
    await page.goto(path)
    await expect(page, path).toHaveURL(/\/login$/)
  }
})

test('an outlet user cannot open admin pages, and an expired/invalid token does not leave a broken page', async ({ page }) => {
  const ctx = await outletWithStock(await adminApi(), { price: 10, stock: 5, allocated: 5 })
  await page.goto('/login')
  await page.getByLabel('Mobile number or username').fill(ctx.outlet.mobileNumber)
  await page.getByLabel('Password', { exact: true }).fill(ctx.outlet.generatedPassword)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/outlet$/)
  await page.goto('/dashboard/outlets')
  await expect(page, 'wrong role should not stay on the admin page').not.toHaveURL(/\/dashboard/)
  // Simulate a token the server rejects (expired / secret rotated) and use the app.
  await page.goto('/outlet')
  await page.evaluate(() => localStorage.setItem('accessToken', 'expired.invalid.token'))
  await page.goto('/outlet/billing')
  await expect(page, 'a 401 should end up back at the login page').toHaveURL(/\/login$/, { timeout: 10_000 })
})

test('unknown URLs fall back to the landing page', async ({ page }) => {
  await page.goto('/this/does/not/exist')
  await expect(page).toHaveURL(/\/$/)
})
