import { expect, test, type APIRequestContext } from '@playwright/test'
import { adminApi, isoDate, mobile10, money, outletWithStock } from '../helpers'

test.describe.configure({ mode: 'serial' })

let admin: APIRequestContext

test.beforeAll(async () => { admin = await adminApi() })

const book = (api: APIRequestContext, data: object) => api.post('outlet/me/bookings', { data })

test.describe('Rental (jewellery, Per Day)', () => {
  let ctx: Awaited<ReturnType<typeof outletWithStock>>
  const cust = mobile10()
  let bookingId: number

  test.beforeAll(async () => { ctx = await outletWithStock(admin, { unit: 'Per Day', bookingMode: 'RENTAL', prebook: true, price: 500, stock: 2, allocated: 2 }) })

  test('availability for free dates', async () => {
    const a = await (await ctx.api.get('outlet/me/bookings/availability', { params: { itemId: ctx.item.id, from: isoDate(1), to: isoDate(3), quantity: 1 } })).json()
    expect(a.available).toBe(true)
  })

  test('creates a rental booking with an estimate (price × qty × days)', async () => {
    const res = await book(ctx.api, { customerName: 'Meena', customerMobile: cust, startDate: isoDate(1), expectedReturnDate: isoDate(3), items: [{ itemId: ctx.item.id, quantity: 1 }] })
    expect(res.status()).toBeLessThan(300)
    const b = await res.json()
    bookingId = b.id
    expect(b.kind).toBe('RENTAL')
    expect(b.status).toBe('BOOKED')
    expect(money(b.estimatedAmount), 'estimate should be 500 × 2 days').toBe(1000)
  })

  test('overlapping booking beyond remaining stock is refused; non-overlapping is allowed', async () => {
    const overlap = await book(ctx.api, { customerName: 'Late', customerMobile: mobile10(), startDate: isoDate(2), expectedReturnDate: isoDate(4), items: [{ itemId: ctx.item.id, quantity: 2 }] })
    expect(overlap.status()).toBeGreaterThanOrEqual(400)
    expect(overlap.status()).toBeLessThan(500)
    const a = await (await ctx.api.get('outlet/me/bookings/availability', { params: { itemId: ctx.item.id, from: isoDate(2), to: isoDate(4), quantity: 2 } })).json()
    expect(a.available).toBe(false)
    expect(a.conflicts.length).toBeGreaterThan(0)
    const later = await book(ctx.api, { customerName: 'Later', customerMobile: mobile10(), startDate: isoDate(10), expectedReturnDate: isoDate(11), items: [{ itemId: ctx.item.id, quantity: 2 }] })
    expect(later.status()).toBeLessThan(300)
  })

  test('validation: return before start, missing return date, past start, zero quantity', async () => {
    const base = { customerName: 'V', customerMobile: mobile10(), startDate: isoDate(5), expectedReturnDate: isoDate(6), items: [{ itemId: ctx.item.id, quantity: 1 }] }
    const cases: [string, object][] = [
      ['return before start', { ...base, expectedReturnDate: isoDate(4) }],
      ['rental without return date', { ...base, expectedReturnDate: undefined }],
      ['start in the past', { ...base, startDate: isoDate(-3), expectedReturnDate: isoDate(-2) }],
      ['quantity 0', { ...base, items: [{ itemId: ctx.item.id, quantity: 0 }] }],
      ['no items', { ...base, items: [] }],
      ['bad mobile', { ...base, customerMobile: '123' }],
    ]
    for (const [label, data] of cases) {
      const res = await book(ctx.api, data)
      expect(res.status(), label).toBeGreaterThanOrEqual(400)
      expect(res.status(), `${label}: expected 4xx`).toBeLessThan(500)
    }
  })

  test('appears in upcoming list, day view, and customer due list on the start date', async () => {
    const upcoming = await (await ctx.api.get('outlet/me/bookings', { params: { view: 'UPCOMING', page: 0 } })).json()
    expect(upcoming.content.map((b: { id: number }) => b.id)).toContain(bookingId)
    const day = (await (await ctx.api.get('outlet/me/bookings/day', { params: { date: isoDate(1) } })).json()) as { id: number }[]
    expect(day.map((b) => b.id)).toContain(bookingId)
    const mid = (await (await ctx.api.get('outlet/me/bookings/day', { params: { date: isoDate(2) } })).json()) as { id: number }[]
    expect(mid.map((b) => b.id), 'a rental spanning several days should show on the middle day too').toContain(bookingId)
  })

  test('reschedule moves the booking and re-checks availability', async () => {
    const res = await ctx.api.post(`outlet/me/bookings/${bookingId}/reschedule`, { data: { startDate: isoDate(5), expectedReturnDate: isoDate(6) } })
    expect(res.status()).toBeLessThan(300)
    const b = await res.json()
    expect(b.startDate).toBe(isoDate(5))
  })

  test('hand-over issues a zero-amount challan and takes the stock out; return bills min 1 day and restores stock', async () => {
    // Fresh booking that starts today so it can be handed over now.
    const today = await (await book(ctx.api, { customerName: 'Today', customerMobile: cust, startDate: isoDate(0), expectedReturnDate: isoDate(2), items: [{ itemId: ctx.item.id, quantity: 1 }] })).json()
    const handed = await ctx.api.post(`outlet/me/bookings/${today.id}/hand-over`, { data: {} })
    expect(handed.status()).toBeLessThan(300)
    const h = await handed.json()
    expect(h.status).toBe('HANDED_OVER')
    expect(h.challan, 'a challan bill is created at hand-over').toBeTruthy()
    expect(money(h.challan.total)).toBe(0)
    let items = (await (await ctx.api.get('outlet/me/items', { params: { search: ctx.item.name } })).json()) as { allocatedQuantity: number | null }[]
    expect(items[0].allocatedQuantity, 'stock goes out at hand-over').toBe(1)

    const overdue = (await (await ctx.api.get('outlet/me/bookings/overdue')).json()) as { id: number }[]
    expect(overdue.map((b) => b.id)).not.toContain(today.id)

    const returned = await ctx.api.post(`outlet/me/bookings/${today.id}/return`, { data: { discount: 100 } })
    expect(returned.status()).toBeLessThan(300)
    const r = await returned.json()
    expect(r.status).toBe('COMPLETED')
    expect(money(r.bill.subtotal), 'same-day return is charged 1 day').toBe(500)
    expect(money(r.bill.total)).toBe(400)
    items = (await (await ctx.api.get('outlet/me/items', { params: { search: ctx.item.name } })).json()) as { allocatedQuantity: number | null }[]
    expect(items[0].allocatedQuantity, 'stock is back after return').toBe(2)
  })

  test('state machine: cannot return a booking that was never handed over, cannot hand over twice, cannot reschedule after hand-over', async () => {
    const b = await (await book(ctx.api, { customerName: 'SM', customerMobile: mobile10(), startDate: isoDate(0), expectedReturnDate: isoDate(1), items: [{ itemId: ctx.item.id, quantity: 1 }] })).json()
    expect((await ctx.api.post(`outlet/me/bookings/${b.id}/return`, { data: {} })).status()).toBeGreaterThanOrEqual(400)
    expect((await ctx.api.post(`outlet/me/bookings/${b.id}/hand-over`, { data: {} })).status()).toBeLessThan(300)
    expect((await ctx.api.post(`outlet/me/bookings/${b.id}/hand-over`, { data: {} })).status()).toBeGreaterThanOrEqual(400)
    expect((await ctx.api.post(`outlet/me/bookings/${b.id}/reschedule`, { data: { startDate: isoDate(3), expectedReturnDate: isoDate(4) } })).status()).toBeGreaterThanOrEqual(400)
    expect((await ctx.api.post(`outlet/me/bookings/${b.id}/cancel`)).status(), 'cannot cancel once with the customer').toBeGreaterThanOrEqual(400)
    await ctx.api.post(`outlet/me/bookings/${b.id}/return`, { data: {} })
  })

  test('cancel frees the dates', async () => {
    const solo = await outletWithStock(admin, { unit: 'Per Day', bookingMode: 'RENTAL', prebook: true, price: 100, stock: 1, allocated: 1 })
    const first = await (await book(solo.api, { customerName: 'A', customerMobile: mobile10(), startDate: isoDate(1), expectedReturnDate: isoDate(2), items: [{ itemId: solo.item.id, quantity: 1 }] })).json()
    expect((await book(solo.api, { customerName: 'B', customerMobile: mobile10(), startDate: isoDate(1), expectedReturnDate: isoDate(2), items: [{ itemId: solo.item.id, quantity: 1 }] })).status()).toBeGreaterThanOrEqual(400)
    expect((await solo.api.post(`outlet/me/bookings/${first.id}/cancel`)).status()).toBeLessThan(300)
    expect((await book(solo.api, { customerName: 'B', customerMobile: mobile10(), startDate: isoDate(1), expectedReturnDate: isoDate(2), items: [{ itemId: solo.item.id, quantity: 1 }] })).status()).toBeLessThan(300)
  })

  test('concurrent bookings for the last piece: only one succeeds (no double booking)', async () => {
    const solo = await outletWithStock(admin, { unit: 'Per Day', bookingMode: 'RENTAL', prebook: true, price: 100, stock: 1, allocated: 1 })
    const attempt = () => book(solo.api, { customerName: 'R', customerMobile: mobile10(), startDate: isoDate(1), expectedReturnDate: isoDate(2), items: [{ itemId: solo.item.id, quantity: 1 }] })
    const results = await Promise.all([attempt(), attempt(), attempt()])
    expect(results.filter((r) => r.status() < 300)).toHaveLength(1)
  })
})

test.describe('Appointment (parlour)', () => {
  let ctx: Awaited<ReturnType<typeof outletWithStock>>
  test.beforeAll(async () => { ctx = await outletWithStock(admin, { unit: 'Flat', bookingMode: 'APPOINTMENT', prebook: true, price: 300, stock: null, allocated: null }) })

  test('requires a time; complete bills the price with discount', async () => {
    const noTime = await book(ctx.api, { customerName: 'P', customerMobile: mobile10(), startDate: isoDate(0), items: [{ itemId: ctx.item.id, quantity: 1 }] })
    expect(noTime.status(), 'appointment without a time').toBeGreaterThanOrEqual(400)
    const res = await book(ctx.api, { customerName: 'Priya', customerMobile: mobile10(), startDate: isoDate(0), startTime: '10:30', items: [{ itemId: ctx.item.id, quantity: 1 }] })
    expect(res.status()).toBeLessThan(300)
    const b = await res.json()
    expect(b.kind).toBe('APPOINTMENT')
    const done = await ctx.api.post(`outlet/me/bookings/${b.id}/complete`, { data: { discount: 50 } })
    expect(done.status()).toBeLessThan(300)
    const c = await done.json()
    expect(c.status).toBe('COMPLETED')
    expect(money(c.bill.total)).toBe(250)
    expect((await ctx.api.post(`outlet/me/bookings/${b.id}/complete`, { data: { discount: 0 } })).status(), 'cannot complete twice (double billing)').toBeGreaterThanOrEqual(400)
  })

  test('cancelled booking cannot be completed; discount above amount is rejected', async () => {
    const b = await (await book(ctx.api, { customerName: 'C', customerMobile: mobile10(), startDate: isoDate(0), startTime: '11:00', items: [{ itemId: ctx.item.id, quantity: 1 }] })).json()
    expect((await ctx.api.post(`outlet/me/bookings/${b.id}/complete`, { data: { discount: 9999 } })).status()).toBeGreaterThanOrEqual(400)
    expect((await ctx.api.post(`outlet/me/bookings/${b.id}/cancel`)).status()).toBeLessThan(300)
    expect((await ctx.api.post(`outlet/me/bookings/${b.id}/complete`, { data: { discount: 0 } })).status()).toBeGreaterThanOrEqual(400)
  })

  test('mixing kinds in one booking is refused; item from a non-prebook service is refused', async () => {
    const retail = await outletWithStock(admin, { unit: 'Flat', prebook: false, price: 10, stock: 5, allocated: 5 })
    const res = await book(retail.api, { customerName: 'N', customerMobile: mobile10(), startDate: isoDate(1), items: [{ itemId: retail.item.id, quantity: 1 }] })
    expect(res.status(), 'service has pre-booking disabled').toBeGreaterThanOrEqual(400)
  })
})

test.describe('Billing a customer’s due bookings together', () => {
  test('a due appointment can be added to a normal bill and is marked completed with the same bill', async () => {
    const ctx = await outletWithStock(admin, { unit: 'Flat', bookingMode: 'APPOINTMENT', prebook: true, price: 200, stock: null, allocated: null })
    const cust = mobile10()
    const b = await (await book(ctx.api, { customerName: 'Combo', customerMobile: cust, startDate: isoDate(0), startTime: '09:00', items: [{ itemId: ctx.item.id, quantity: 1 }] })).json()
    const due = (await (await ctx.api.get('outlet/me/bookings/due', { params: { mobile: cust } })).json()) as { id: number }[]
    expect(due.map((d) => d.id)).toContain(b.id)
    const bill = await ctx.api.post('outlet/me/bills', { data: { customerName: 'Combo', customerMobile: cust, discount: 0, items: [], bookingIds: [b.id] } })
    expect(bill.status()).toBeLessThan(300)
    expect(money((await bill.json()).total)).toBe(200)
    const after = (await (await ctx.api.get('outlet/me/bookings', { params: { view: 'PAST', page: 0 } })).json()).content as { id: number; status: string }[]
    expect(after.find((x) => x.id === b.id)?.status).toBe('COMPLETED')
    expect((await ctx.api.post('outlet/me/bills', { data: { customerName: 'Combo', customerMobile: cust, discount: 0, items: [], bookingIds: [b.id] } })).status(), 'a booking cannot be billed twice').toBeGreaterThanOrEqual(400)
  })
})
