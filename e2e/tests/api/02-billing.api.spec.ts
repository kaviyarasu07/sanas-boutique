import { expect, test, type APIRequestContext } from '@playwright/test'
import { adminApi, isoDate, mobile10, money, outletWithStock } from '../helpers'

test.describe.configure({ mode: 'serial' })

let admin: APIRequestContext
let ctx: Awaited<ReturnType<typeof outletWithStock>>
const customerMobile = mobile10()

const bill = (api: APIRequestContext, data: object) => api.post('outlet/me/bills', { data })

test.beforeAll(async () => {
  admin = await adminApi()
  // Outlet allocation (5) is deliberately lower than the catalog quantity (50): the outlet's own allocation must win.
  ctx = await outletWithStock(admin, { price: 100, stock: 50, allocated: 5 })
})

test('creates a bill: totals, number, customer record', async () => {
  const res = await bill(ctx.api, { customerName: 'Asha', customerMobile, discount: 20, items: [{ itemId: ctx.item.id, quantity: 3 }], bookingIds: [] })
  expect(res.status()).toBeLessThan(300)
  const b = await res.json()
  expect(b.billNumber).toMatch(/\S+/)
  expect(money(b.subtotal)).toBe(300)
  expect(money(b.discount)).toBe(20)
  expect(money(b.total)).toBe(280)
  expect(b.items).toHaveLength(1)
  expect(b.items[0].quantity).toBe(3)
  expect(money(b.items[0].lineTotal)).toBe(300)
  const customers = (await (await ctx.api.get('outlet/me/bills/customers', { params: { mobile: customerMobile } })).json()) as { mobileNumber: string; name: string }[]
  expect(customers.some((c) => c.mobileNumber === customerMobile && c.name === 'Asha')).toBe(true)
})

test('stock is reduced by the sale (outlet allocation 5 → 2)', async () => {
  const items = (await (await ctx.api.get('outlet/me/items', { params: { search: ctx.item.name } })).json()) as { allocatedQuantity: number | null }[]
  expect(items[0].allocatedQuantity).toBe(2)
})

test('cannot sell more than the outlet has', async () => {
  const res = await bill(ctx.api, { customerName: 'Asha', customerMobile, discount: 0, items: [{ itemId: ctx.item.id, quantity: 3 }], bookingIds: [] })
  expect(res.status()).toBeGreaterThanOrEqual(400)
  expect(res.status()).toBeLessThan(500)
  const items = (await (await ctx.api.get('outlet/me/items', { params: { search: ctx.item.name } })).json()) as { allocatedQuantity: number | null }[]
  expect(items[0].allocatedQuantity, 'a rejected bill must not change stock').toBe(2)
})

test('validation: discount above subtotal, bad mobile, empty bill, zero/negative quantity', async () => {
  const base = { customerName: 'Asha', customerMobile, discount: 0, items: [{ itemId: ctx.item.id, quantity: 1 }], bookingIds: [] }
  const cases: [string, object][] = [
    ['discount > subtotal', { ...base, discount: 101 }],
    ['negative discount', { ...base, discount: -1 }],
    ['9-digit mobile', { ...base, customerMobile: '912345678' }],
    ['letters in mobile', { ...base, customerMobile: '91234abcde' }],
    ['blank name', { ...base, customerName: '  ' }],
    ['no items', { ...base, items: [] }],
    ['quantity 0', { ...base, items: [{ itemId: ctx.item.id, quantity: 0 }] }],
    ['quantity -1', { ...base, items: [{ itemId: ctx.item.id, quantity: -1 }] }],
    ['unknown item', { ...base, items: [{ itemId: 999999999, quantity: 1 }] }],
  ]
  for (const [label, data] of cases) {
    const res = await bill(ctx.api, data)
    expect(res.status(), label).toBeGreaterThanOrEqual(400)
    expect(res.status(), `${label} should be a 4xx, not a server error`).toBeLessThan(500)
  }
})

test('two simultaneous bills for the last unit: exactly one wins, stock never goes negative', async () => {
  const last = await outletWithStock(admin, { price: 10, stock: 1, allocated: 1 })
  const make = () => bill(last.api, { customerName: 'Race', customerMobile: mobile10(), discount: 0, items: [{ itemId: last.item.id, quantity: 1 }], bookingIds: [] })
  const results = await Promise.all([make(), make(), make()])
  const ok = results.filter((r) => r.status() < 300).length
  expect(ok, 'only one of three concurrent bills may succeed').toBe(1)
  const items = (await (await last.api.get('outlet/me/items', { params: { search: last.item.name } })).json()) as { allocatedQuantity: number | null }[]
  expect(items[0].allocatedQuantity).toBe(0)
})

test('bill numbers are unique under concurrency', async () => {
  const many = await outletWithStock(admin, { price: 5, stock: null, allocated: null })
  const results = await Promise.all(Array.from({ length: 8 }, () => bill(many.api, { customerName: 'N', customerMobile: mobile10(), discount: 0, items: [{ itemId: many.item.id, quantity: 1 }], bookingIds: [] })))
  const numbers = await Promise.all(results.filter((r) => r.status() < 300).map(async (r) => (await r.json()).billNumber as string))
  expect(numbers.length, 'all 8 concurrent bills should succeed').toBe(8)
  expect(new Set(numbers).size).toBe(8)
})

test('items without stock tracking are unlimited', async () => {
  const unlimited = await outletWithStock(admin, { price: 7, stock: null, allocated: null })
  const res = await bill(unlimited.api, { customerName: 'U', customerMobile: mobile10(), discount: 0, items: [{ itemId: unlimited.item.id, quantity: 500 }], bookingIds: [] })
  expect(res.status()).toBeLessThan(300)
})

test('bill appears in recent, search-by-number, date filter, and today total', async () => {
  const created = await (await bill(ctx.api, { customerName: 'Find Me', customerMobile: mobile10(), discount: 0, items: [{ itemId: ctx.item.id, quantity: 1 }], bookingIds: [] })).json()
  const recent = (await (await ctx.api.get('outlet/me/bills/recent')).json()) as { billNumber: string }[]
  expect(recent.map((b) => b.billNumber)).toContain(created.billNumber)
  const byNumber = await (await ctx.api.get('outlet/me/bills', { params: { search: created.billNumber, page: 0, size: 50 } })).json()
  expect(byNumber.content.map((b: { billNumber: string }) => b.billNumber)).toEqual([created.billNumber])
  const future = await (await ctx.api.get('outlet/me/bills', { params: { from: isoDate(2), to: isoDate(3), page: 0, size: 50 } })).json()
  expect(future.content).toHaveLength(0)
  const today = (await (await ctx.api.get('outlet/me/bills/today-total')).json()) as number
  expect(today).toBeGreaterThanOrEqual(280)
})

test('customer list shows spend and bill count', async () => {
  const page = await (await ctx.api.get('outlet/me/bills/customer-list', { params: { search: customerMobile, page: 0 } })).json()
  const c = page.content.find((x: { mobileNumber: string }) => x.mobileNumber === customerMobile)
  expect(c).toBeTruthy()
  expect(c.billCount).toBe(1)
  expect(money(c.totalSpent)).toBe(280)
})

test('same mobile with a different name does not create a second customer', async () => {
  await bill(ctx.api, { customerName: 'Asha Renamed', customerMobile, discount: 0, items: [{ itemId: ctx.item.id, quantity: 1 }], bookingIds: [] })
  const page = await (await ctx.api.get('outlet/me/bills/customer-list', { params: { search: customerMobile, page: 0 } })).json()
  expect(page.content.filter((x: { mobileNumber: string }) => x.mobileNumber === customerMobile)).toHaveLength(1)
})

test('analytics and report use different definitions: bill totals (after discount) vs line totals (before discount)', async () => {
  const fresh = await outletWithStock(admin, { price: 100, stock: null, allocated: null })
  const b = await (await bill(fresh.api, { customerName: 'A', customerMobile: mobile10(), discount: 25, items: [{ itemId: fresh.item.id, quantity: 2 }], bookingIds: [] })).json()
  const analytics = await (await fresh.api.get('outlet/me/bills/analytics')).json()
  expect(money(analytics.today.total)).toBe(money(b.total))
  const report = await (await fresh.api.post('outlet/me/bills/report', { data: { outletIds: [], serviceIds: [], from: isoDate(0), to: isoDate(0) } })).json()
  expect(money(report.totalSales)).toBe(money(b.subtotal))
  expect(money(report.totalSales), 'UX issue BUG-06: report and dashboard disagree whenever a discount was given').not.toBe(money(analytics.today.total))
})

