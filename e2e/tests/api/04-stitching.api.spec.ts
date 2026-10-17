import { expect, test, type APIRequestContext } from '@playwright/test'
import { adminApi, isoDate, mobile10, money, outletWithStock } from '../helpers'

test.describe.configure({ mode: 'serial' })

let api: APIRequestContext
const create = (data: object) => api.post('outlet/me/stitching', { data })
/** Two garments with their own delivery dates; the blouse is priced, the salwar price is added later. */
const order = (over: object = {}) => ({ customerName: 'Lakshmi', customerMobile: mobile10(), notes: 'rush', items: [{ garment: 'Blouse', measurements: 'Bust 36, Waist 30', deliveryDate: isoDate(3), amount: 400 }, { garment: 'Salwar', notes: 'loose', deliveryDate: isoDate(6) }], ...over })
const status = (id: number, itemId: number, s: string) => api.post(`outlet/me/stitching/${id}/items/${itemId}/status`, { data: { status: s } })

test.beforeAll(async () => {
  const ctx = await outletWithStock(await adminApi(), { price: 1, stock: null, allocated: null })
  api = ctx.api
})

test('create → receipt number, garments Not started, appears in the right lists', async () => {
  const res = await create(order({ advance: 300 }))
  expect(res.status()).toBeLessThan(300)
  const o = await res.json()
  expect(o.orderNumber).toMatch(/^STC-\d+$/)
  expect(o.status).toBe('OPEN')
  expect(o.items.map((i: { status: string }) => i.status)).toEqual(['NOT_STARTED', 'NOT_STARTED'])
  expect(money(o.total)).toBe(400)
  expect(o.unpricedCount).toBe(1)
  expect(money(o.advancePaid)).toBe(300)
  expect(o.estimatedDeliveryDate, 'next delivery = earliest garment').toBe(isoDate(3))
  const open = await (await api.get('outlet/me/stitching', { params: { view: 'OPEN', page: 0 } })).json()
  expect(open.content.map((x: { id: number }) => x.id)).toContain(o.id)
  const looked = await (await api.get('outlet/me/stitching/lookup', { params: { code: o.orderNumber.toLowerCase() } })).json()
  expect(looked.id, 'scan / typed receipt number').toBe(o.id)
  const due = (await (await api.get('outlet/me/stitching/due', { params: { date: isoDate(6) } })).json()) as { id: number }[]
  expect(due.map((x) => x.id), 'due list is per garment date').toContain(o.id)
  const log = await (await api.get(`outlet/me/stitching/${o.id}/log`)).json()
  expect(log[0].kind).toBe('CREATED')
})

test('validation: past delivery date, blank garment, no garments, bad mobile, advance above total', async () => {
  const cases: [string, object][] = [
    ['delivery in the past', order({ items: [{ garment: 'Blouse', deliveryDate: isoDate(-1) }] })],
    ['blank garment', order({ items: [{ garment: '  ', deliveryDate: isoDate(2) }] })],
    ['no garments', order({ items: [] })],
    ['bad mobile', order({ customerMobile: '12345' })],
    ['missing delivery date', order({ items: [{ garment: 'Blouse' }] })],
    ['advance above the total', order({ items: [{ garment: 'Blouse', deliveryDate: isoDate(2), amount: 100 }], advance: 101 })],
  ]
  for (const [label, data] of cases) {
    const res = await create(data)
    expect(res.status(), label).toBeGreaterThanOrEqual(400)
    expect(res.status(), `${label}: expected 4xx`).toBeLessThan(500)
  }
})

test('partial delivery: bill only finished garments, advance used on the first bill', async () => {
  const o = await (await create(order({ advance: 300 }))).json()
  const [blouse, salwar] = o.items as { id: number }[]
  expect((await api.post(`outlet/me/stitching/${o.id}/deliver`, { data: { itemIds: [blouse.id] } })).status(), 'not finished yet').toBeGreaterThanOrEqual(400)
  await status(o.id, blouse.id, 'STARTED')
  await status(o.id, blouse.id, 'FINISHED')
  const first = await (await api.post(`outlet/me/stitching/${o.id}/deliver`, { data: { itemIds: [blouse.id], discount: 0 } })).json()
  expect(first.status, 'salwar is still open').toBe('OPEN')
  expect(first.bills[0].billNumber).toContain('-ST-')
  expect(money(first.bills[0].total)).toBe(400)
  expect(money(first.bills[0].advancePaid)).toBe(300)
  expect(money(first.bills[0].balance)).toBe(100)

  await status(o.id, salwar.id, 'FINISHED')
  const noPrice = await api.post(`outlet/me/stitching/${o.id}/deliver`, { data: { itemIds: [salwar.id] } })
  expect(noPrice.status(), 'price required before billing').toBeGreaterThanOrEqual(400)
  const last = await (await api.post(`outlet/me/stitching/${o.id}/deliver`, { data: { itemIds: [salwar.id], prices: [{ itemId: salwar.id, amount: 600 }], discount: 100 } })).json()
  expect(last.status).toBe('DELIVERED')
  expect(money(last.bills[1].total)).toBe(500)
  expect(money(last.bills[1].advancePaid)).toBe(0)
  expect((await api.post(`outlet/me/stitching/${o.id}/cancel`, { data: { reason: 'x' } })).status(), 'cannot cancel a delivered order').toBeGreaterThanOrEqual(400)
})

test('status can move back; delivered is not a status staff can pick', async () => {
  const o = await (await create(order())).json()
  const item = o.items[0].id
  await status(o.id, item, 'FINISHED')
  const back = await (await status(o.id, item, 'STARTED')).json()
  expect(back.items[0].status).toBe('STARTED')
  expect((await status(o.id, item, 'DELIVERED')).status()).toBeGreaterThanOrEqual(400)
})

test('cancel with advance → refund decided by the outlet, rest kept', async () => {
  const o = await (await create(order({ advance: 400 }))).json()
  const cancelled = await (await api.post(`outlet/me/stitching/${o.id}/cancel`, { data: { reason: 'Customer cancelled' } })).json()
  expect(cancelled.status).toBe('CANCELLED')
  expect((await api.post(`outlet/me/stitching/${o.id}/refunds`, { data: { amount: 401 } })).status(), 'more than the advance left').toBeGreaterThanOrEqual(400)
  const refunded = await (await api.post(`outlet/me/stitching/${o.id}/refunds`, { data: { amount: 250, reason: 'Customer cancelled' } })).json()
  const refund = refunded.payments.find((p: { kind: string }) => p.kind === 'REFUND')
  expect(money(refund.amount)).toBe(250)
  expect(money(refund.keptAmount)).toBe(150)
  expect(refund.refundNumber).toContain('-RF-')
  expect(money(refunded.advanceAvailable)).toBe(0)
})

test('comments stay with the order and are allowed after it closes', async () => {
  const o = await (await create(order())).json()
  await api.post(`outlet/me/stitching/${o.id}/cancel`, { data: { reason: 'Other', comment: 'changed mind' } })
  const log = await (await api.post(`outlet/me/stitching/${o.id}/comments`, { data: { text: 'Called customer', authorName: 'Kavya' } })).json()
  const last = log[log.length - 1]
  expect(last.kind).toBe('COMMENT')
  expect(last.authorName).toBe('Kavya')
})

test('stitching revenue shows up in outlet analytics (bill total, not the advance)', async () => {
  const before = await (await api.get('outlet/me/bills/analytics')).json()
  const o = await (await create(order({ items: [{ garment: 'Kurta', deliveryDate: isoDate(1), amount: 250 }], advance: 100 }))).json()
  await status(o.id, o.items[0].id, 'FINISHED')
  await api.post(`outlet/me/stitching/${o.id}/deliver`, { data: { itemIds: [o.items[0].id], discount: 0 } })
  const after = await (await api.get('outlet/me/bills/analytics')).json()
  expect(money(after.today.total - before.today.total)).toBe(250)
  expect(after.today.bills - before.today.bills).toBe(1)
})
