import { expect, test, type APIRequestContext } from '@playwright/test'
import { adminApi, anon, authed, isoDate, mobile10, outletWithStock } from '../helpers'

test.describe.configure({ mode: 'serial' })

let admin: APIRequestContext
let A: Awaited<ReturnType<typeof outletWithStock>>
let B: Awaited<ReturnType<typeof outletWithStock>>
let billA: { id: number; billNumber: string }
let customerA: number
let bookingA: number
let stitchA: number

test.beforeAll(async () => {
  admin = await adminApi()
  A = await outletWithStock(admin, { unit: 'Per Day', bookingMode: 'RENTAL', prebook: true, price: 100, stock: 5, allocated: 5 })
  B = await outletWithStock(admin, { price: 100, stock: 5, allocated: 5 })
  const cust = mobile10()
  billA = await (await A.api.post('outlet/me/bills', { data: { customerName: 'Secret A', customerMobile: cust, discount: 0, items: [{ itemId: A.item.id, quantity: 1 }], bookingIds: [] } })).json()
  const customers = await (await A.api.get('outlet/me/bills/customer-list', { params: { search: cust, page: 0 } })).json()
  customerA = customers.content[0].id
  bookingA = (await (await A.api.post('outlet/me/bookings', { data: { customerName: 'Secret A', customerMobile: cust, startDate: isoDate(1), expectedReturnDate: isoDate(2), items: [{ itemId: A.item.id, quantity: 1 }] } })).json()).id
  stitchA = (await (await A.api.post('outlet/me/stitching', { data: { customerName: 'Secret A', customerMobile: cust, items: [{ garment: 'Blouse', deliveryDate: isoDate(2) }] } })).json()).id
})

test.describe('Unauthenticated', () => {
  const endpoints = ['outlet/me', 'outlet/me/bills', 'outlet/me/bookings?view=UPCOMING', 'outlet/me/stitching?view=OPEN', 'outlets', 'services', 'price-units', 'admin/bills', 'admin/analytics', 'admin/sales-summary']
  for (const ep of endpoints) {
    test(`GET ${ep} → 401`, async () => {
      expect((await (await anon()).get(ep)).status()).toBe(401)
    })
  }
  test('tampered and garbage tokens → 401', async () => {
    const good = A.token.split('.')
    const forged = `${good[0]}.${good[1]}.${good[2].slice(0, -3)}abc`
    for (const t of [forged, 'not-a-jwt', `${good[0]}.${good[1]}.`]) {
      expect((await (await authed(t)).get('outlet/me')).status(), t.slice(0, 20)).toBe(401)
    }
  })
  test('health endpoint is public, actuator internals are not', async () => {
    const base = (process.env.API_URL ?? 'http://localhost:8080/api').replace(/\/api\/?$/, '')
    const ctx = await anon()
    expect((await ctx.get(`${base}/actuator/health`)).status()).toBe(200)
    for (const p of ['/actuator/env', '/actuator/beans', '/actuator/heapdump']) expect((await ctx.get(`${base}${p}`)).status(), p).toBeGreaterThanOrEqual(401)
  })
})

test.describe('Role boundaries', () => {
  test('outlet token cannot use admin endpoints', async () => {
    for (const [method, path] of [['get', 'outlets'], ['get', 'admin/bills'], ['get', 'admin/analytics'], ['get', 'admin/sales-summary'], ['post', 'services'], ['post', 'outlets'], ['post', 'admin/reports/sales']] as const) {
      const res = await A.api[method](path, method === 'post' ? { data: {} } : undefined)
      expect(res.status(), `${method} ${path}`).toBe(403)
    }
  })
  test('outlet token cannot edit catalog items or other outlets’ allocations', async () => {
    expect((await A.api.patch(`service-items/${A.item.id}`, { data: { name: 'hax', price: 0.01 } })).status()).toBe(403)
    expect((await A.api.patch(`outlets/${B.outlet.id}/services/${B.service.id}`, { data: { allowed: false } })).status()).toBe(403)
  })
  test('admin token has no outlet: /outlet/me/* is refused cleanly (4xx, not 500)', async () => {
    const res = await admin.get('outlet/me/bills')
    expect(res.status()).toBeGreaterThanOrEqual(400)
    expect(res.status()).toBeLessThan(500)
  })
})

test.describe('Tenant isolation: outlet B must not see or touch outlet A’s data', () => {
  test('lists are scoped', async () => {
    const bills = await (await B.api.get('outlet/me/bills', { params: { search: billA.billNumber, page: 0, size: 50 } })).json()
    expect(bills.content).toHaveLength(0)
    const customers = await (await B.api.get('outlet/me/bills/customer-list', { params: { search: 'Secret', page: 0 } })).json()
    expect(customers.content).toHaveLength(0)
    const day = (await (await B.api.get('outlet/me/bookings/day', { params: { date: isoDate(1) } })).json()) as unknown[]
    expect(day).toHaveLength(0)
    const stitch = await (await B.api.get('outlet/me/stitching', { params: { view: 'OPEN', page: 0 } })).json()
    expect(stitch.content).toHaveLength(0)
  })
  test('direct object ids from another outlet are refused (IDOR)', async () => {
    for (const res of [
      await B.api.get(`outlet/me/bills/customer-list/${customerA}`),
      await B.api.get(`outlet/me/bills/customer-list/${customerA}/bills`, { params: { page: 0 } }),
      await B.api.post(`outlet/me/bookings/${bookingA}/cancel`),
      await B.api.post(`outlet/me/bookings/${bookingA}/hand-over`, { data: {} }),
      await B.api.get(`outlet/me/stitching/${stitchA}`),
      await B.api.get(`outlet/me/stitching/${stitchA}/log`),
      await B.api.post(`outlet/me/stitching/${stitchA}/cancel`, { data: { reason: 'x' } }),
      await B.api.put(`outlet/me/stitching/${stitchA}`, { data: { notes: 'x' } }),
      await B.api.post(`outlet/me/stitching/${stitchA}/advances`, { data: { amount: 10 } }),
      await B.api.post(`outlet/me/stitching/${stitchA}/comments`, { data: { text: 'x' } }),
    ]) {
      expect([403, 404], `${res.url()} → ${res.status()}`).toContain(res.status())
    }
    const still = await (await A.api.get('outlet/me/bookings/day', { params: { date: isoDate(1) } })).json()
    expect(still.find((b: { id: number }) => b.id === bookingA).status).toBe('BOOKED')
  })
  test('cannot bill or book another outlet’s item', async () => {
    const bill = await B.api.post('outlet/me/bills', { data: { customerName: 'x', customerMobile: mobile10(), discount: 0, items: [{ itemId: A.item.id, quantity: 1 }], bookingIds: [] } })
    expect(bill.status()).toBeGreaterThanOrEqual(400)
    const book = await B.api.post('outlet/me/bookings', { data: { customerName: 'x', customerMobile: mobile10(), startDate: isoDate(1), expectedReturnDate: isoDate(2), items: [{ itemId: A.item.id, quantity: 1 }] } })
    expect(book.status()).toBeGreaterThanOrEqual(400)
    const claim = await B.api.post('outlet/me/bills', { data: { customerName: 'x', customerMobile: mobile10(), discount: 0, items: [], bookingIds: [bookingA] } })
    expect(claim.status(), 'cannot pull another outlet’s booking into your bill').toBeGreaterThanOrEqual(400)
  })
  test('report criteria cannot be widened to other outlets by an outlet user', async () => {
    const report = await (await B.api.post('outlet/me/bills/report', { data: { outletIds: [A.outlet.id], serviceIds: [], from: isoDate(0), to: isoDate(0) } })).json()
    expect(report.billCount, 'server must pin the report to the caller’s outlet').toBe(0)
  })
})

test.describe('Input hardening', () => {
  test('SQL-ish and HTML input is stored as text and does not break search', async () => {
    const evil = `Robert'); DROP TABLE bill;-- <img src=x onerror=alert(1)>`
    const res = await A.api.post('outlet/me/bills', { data: { customerName: evil, customerMobile: mobile10(), discount: 0, items: [{ itemId: A.item.id, quantity: 1 }], bookingIds: [] } })
    expect(res.status()).toBeLessThan(500)
    const search = await A.api.get('outlet/me/bills', { params: { search: "'; --", page: 0, size: 50 } })
    expect(search.status()).toBeLessThan(500)
  })
  test('oversized page size is capped or refused, not honoured blindly', async () => {
    const res = await A.api.get('outlet/me/bills', { params: { page: 0, size: 100000 } })
    expect(res.status()).toBeLessThan(500)
    if (res.status() < 300) expect((await res.json()).size).toBeLessThanOrEqual(200)
  })
  test('malformed JSON and wrong types give 400, not 500', async () => {
    const raw = await A.api.post('outlet/me/bills', { headers: { 'Content-Type': 'application/json' }, data: '{not json' })
    expect(raw.status()).toBe(400)
    const wrong = await A.api.post('outlet/me/bills', { data: { customerName: 5, customerMobile: {}, discount: 'abc', items: 'x', bookingIds: null } })
    expect(wrong.status()).toBe(400)
  })
})
