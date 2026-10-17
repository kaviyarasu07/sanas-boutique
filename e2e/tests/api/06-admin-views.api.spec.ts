import { expect, test, type APIRequestContext } from '@playwright/test'
import { adminApi, isoDate, mobile10, money, outletWithStock } from '../helpers'

test.describe.configure({ mode: 'serial' })

let admin: APIRequestContext
let ctx: Awaited<ReturnType<typeof outletWithStock>>
let total = 0

test.beforeAll(async () => {
  admin = await adminApi()
  ctx = await outletWithStock(admin, { price: 100, stock: null, allocated: null })
  for (const [qty, discount] of [[2, 0], [1, 10]] as const) {
    const b = await (await ctx.api.post('outlet/me/bills', { data: { customerName: 'Admin view', customerMobile: mobile10(), discount, items: [{ itemId: ctx.item.id, quantity: qty }], bookingIds: [] } })).json()
    total += b.total
  }
})

test('sales summary lists the outlet with today and month totals', async () => {
  const s = await (await admin.get('admin/sales-summary')).json()
  const row = s.outlets.find((o: { outletId: number }) => o.outletId === ctx.outlet.id)
  expect(row).toBeTruthy()
  expect(money(row.todayTotal)).toBe(money(total))
  expect(money(row.monthTotal)).toBeGreaterThanOrEqual(money(total))
  expect(s.totalOutlets).toBeGreaterThanOrEqual(s.activeOutlets)
})

test('admin outlet dashboard, analytics and bill list agree with each other', async () => {
  const d = await (await admin.get(`admin/outlets/${ctx.outlet.id}/dashboard`)).json()
  expect(money(d.todayTotal)).toBe(money(total))
  expect(d.totalBillsToday).toBe(2)
  const a = await (await admin.get(`admin/outlets/${ctx.outlet.id}/analytics`)).json()
  expect(money(a.today.total)).toBe(money(total))
  expect(a.today.bills).toBe(2)
  const bills = await (await admin.get('admin/bills', { params: { outletId: ctx.outlet.id, page: 0, size: 50 } })).json()
  expect(bills.content).toHaveLength(2)
  expect(money(bills.content.reduce((s: number, b: { total: number }) => s + b.total, 0))).toBe(money(total))
})

test('admin sales report can be limited to one outlet and one service', async () => {
  const r = await (await admin.post('admin/reports/sales', { data: { outletIds: [ctx.outlet.id], serviceIds: [ctx.service.id], from: isoDate(0), to: isoDate(0) } })).json()
  expect(r.billCount).toBe(2)
  expect(r.units).toBe(3)
  expect(money(r.totalSales)).toBe(300)
  expect(r.byOutlet).toHaveLength(1)
  expect(r.byService).toHaveLength(1)
})

test('report with from after to is rejected or empty, never a 500', async () => {
  const res = await admin.post('admin/reports/sales', { data: { outletIds: [], serviceIds: [], from: isoDate(3), to: isoDate(0) } })
  expect(res.status()).toBeLessThan(500)
})

test('admin bill search by number and by date range', async () => {
  const bills = await (await admin.get('admin/bills', { params: { outletId: ctx.outlet.id, page: 0, size: 50 } })).json()
  const one = bills.content[0]
  const found = await (await admin.get('admin/bills', { params: { search: one.billNumber, page: 0, size: 50 } })).json()
  expect(found.content.map((b: { billNumber: string }) => b.billNumber)).toEqual([one.billNumber])
  const none = await (await admin.get('admin/bills', { params: { outletId: ctx.outlet.id, from: isoDate(5), to: isoDate(6), page: 0, size: 50 } })).json()
  expect(none.content).toHaveLength(0)
})
