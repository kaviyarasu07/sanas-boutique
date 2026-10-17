import { expect, test, type APIRequestContext } from '@playwright/test'
import { adminApi, allowItem, allowService, anon, authed, createItem, createOutlet, createService, loginToken, outletLoginName, uid } from '../helpers'

test.describe.configure({ mode: 'serial' })

let admin: APIRequestContext

test.beforeAll(async () => { admin = await adminApi() })

test.describe('Auth basics', () => {
  test('setup-status reports an admin exists', async () => {
    const res = await (await anon()).get('auth/setup-status')
    expect(res.status()).toBe(200)
    expect((await res.json()).adminExists).toBe(true)
  })

  test('one-time setup is refused once an admin exists', async () => {
    const res = await (await anon()).post('auth/setup', { data: { fullName: 'Intruder', username: `intruder${uid()}`, mobileNo: '9000000000', password: 'password123' } })
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })

  test('wrong password and unknown user give the same status and message (no user enumeration)', async () => {
    const ctx = await anon()
    const a = await ctx.post('auth/login', { data: { username: process.env.ADMIN_USERNAME, password: 'definitely-wrong' } })
    const b = await ctx.post('auth/login', { data: { username: `nobody-${uid()}`, password: 'definitely-wrong' } })
    expect([a.status(), b.status()]).toEqual([401, 401])
    expect(await a.text()).toBe(await b.text())
  })
})

test.describe('Catalog (admin)', () => {
  test('default price units exist', async () => {
    const units = (await (await admin.get('price-units')).json()) as { name: string }[]
    for (const n of ['Flat', 'Per Day', 'Per Hour', 'Per Meter', 'Per Piece']) expect(units.map((u) => u.name)).toContain(n)
  })

  test('service names are unique', async () => {
    const name = `E2E Dup ${uid()}`
    await createService(admin, { name, priceUnit: 'Flat' })
    const units = (await (await admin.get('price-units')).json()) as { id: number; name: string }[]
    const res = await admin.post('services', { data: { name, priceUnitId: units[0].id, prebookEnabled: false } })
    expect(res.status()).toBeGreaterThanOrEqual(400)
    expect(res.status()).toBeLessThan(500)
  })

  test('item gets a generated item code and can be found by it', async () => {
    const service = await createService(admin, { name: `E2E Codes ${uid()}`, priceUnit: 'Flat' })
    const item = await createItem(admin, service.id, { name: 'Coded item', price: 99.5, quantity: 3 })
    expect(item.itemCode).toBeTruthy()
    const found = await admin.get(`service-items/by-code/${encodeURIComponent(item.itemCode!)}`)
    expect(found.status()).toBe(200)
    expect((await found.json()).id).toBe(item.id)
  })

  test('rejects negative price, negative quantity and blank name', async () => {
    const service = await createService(admin, { name: `E2E Validation ${uid()}`, priceUnit: 'Flat' })
    for (const data of [{ name: 'neg price', price: -1, quantity: 1 }, { name: 'neg qty', price: 10, quantity: -5 }, { name: '   ', price: 10, quantity: 1 }]) {
      const res = await admin.post(`services/${service.id}/items`, { data })
      expect(res.status(), JSON.stringify(data)).toBeGreaterThanOrEqual(400)
      expect(res.status(), JSON.stringify(data)).toBeLessThan(500)
    }
  })

  test('deactivated item is not billable and not searchable by the outlet', async () => {
    const service = await createService(admin, { name: `E2E Deact ${uid()}`, priceUnit: 'Flat' })
    const item = await createItem(admin, service.id, { name: `Deact ${uid()}`, price: 10, quantity: 5 })
    const outlet = await createOutlet(admin)
    await allowService(admin, outlet.id, service.id)
    await allowItem(admin, outlet.id, service.id, item.id, 5)
    const outletApi = await authed(await loginToken(outletLoginName(outlet), outlet.generatedPassword))
    expect(((await (await outletApi.get('outlet/me/items', { params: { search: item.name } })).json()) as unknown[]).length).toBe(1)
    expect((await admin.patch(`service-items/${item.id}/active`, { data: { active: false } })).status()).toBeLessThan(300)
    expect(((await (await outletApi.get('outlet/me/items', { params: { search: item.name } })).json()) as unknown[]).length).toBe(0)
    const bill = await outletApi.post('outlet/me/bills', { data: { customerName: 'X', customerMobile: '9111111111', discount: 0, items: [{ itemId: item.id, quantity: 1 }], bookingIds: [] } })
    expect(bill.status()).toBeGreaterThanOrEqual(400)
  })
})

test.describe('Outlet lifecycle (admin)', () => {
  test('create returns a one-time password; duplicate mobile or email is rejected', async () => {
    const outlet = await createOutlet(admin)
    expect(outlet.generatedPassword.length).toBeGreaterThanOrEqual(8)
    const dupMobile = await admin.post('outlets', { data: { ...outlet.payload, email: `other-${uid()}@example.test` } })
    expect(dupMobile.status()).toBeGreaterThanOrEqual(400)
    const dupEmail = await admin.post('outlets', { data: { ...outlet.payload, mobileNumber: '9' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0') } })
    expect(dupEmail.status()).toBeGreaterThanOrEqual(400)
  })

  test('outlet can log in with the generated password; regenerate invalidates the old one', async () => {
    const outlet = await createOutlet(admin)
    await loginToken(outletLoginName(outlet), outlet.generatedPassword)
    const regen = await admin.post(`outlets/${outlet.id}/regenerate-password`)
    expect(regen.status()).toBeLessThan(300)
    const fresh = (await regen.json()).generatedPassword as string
    expect(fresh).not.toBe(outlet.generatedPassword)
    const old = await (await anon()).post('auth/login', { data: { username: outletLoginName(outlet), password: outlet.generatedPassword } })
    expect(old.status()).toBe(401)
    await loginToken(outletLoginName(outlet), fresh)
  })

  test('disabled outlet cannot log in, and an already-issued token stops working', async () => {
    const outlet = await createOutlet(admin)
    const token = await loginToken(outletLoginName(outlet), outlet.generatedPassword)
    expect((await admin.patch(`outlets/${outlet.id}/active`, { data: { active: false } })).status()).toBeLessThan(300)
    const relogin = await (await anon()).post('auth/login', { data: { username: outletLoginName(outlet), password: outlet.generatedPassword } })
    expect(relogin.status()).toBeGreaterThanOrEqual(400)
    // Security expectation: the 12h JWT must not keep working after the outlet is disabled.
    const stale = await (await authed(token)).get('outlet/me')
    expect([401, 403], 'token issued before disabling should be rejected').toContain(stale.status())
    await admin.patch(`outlets/${outlet.id}/active`, { data: { active: true } })
  })

  test('outlet only sees services and items the admin allowed', async () => {
    const tag = uid()
    const allowed = await createService(admin, { name: `E2E Allowed ${tag}`, priceUnit: 'Flat' })
    const hidden = await createService(admin, { name: `E2E Hidden ${tag}`, priceUnit: 'Flat' })
    const a = await createItem(admin, allowed.id, { name: `A ${tag}`, price: 10, quantity: 5 })
    await createItem(admin, hidden.id, { name: `H ${tag}`, price: 10, quantity: 5 })
    const outlet = await createOutlet(admin)
    await allowService(admin, outlet.id, allowed.id)
    await allowItem(admin, outlet.id, allowed.id, a.id, 5)
    const api = await authed(await loginToken(outletLoginName(outlet), outlet.generatedPassword))
    const services = (await (await api.get('outlet/me/services')).json()) as { id: number; allowed: boolean }[]
    expect(services.find((s) => s.id === allowed.id)?.allowed).toBe(true)
    expect(services.find((s) => s.id === hidden.id)?.allowed ?? false).toBe(false)
    const items = (await (await api.get('outlet/me/items', { params: { search: tag } })).json()) as { name: string }[]
    expect(items.map((i) => i.name)).toEqual([`A ${tag}`])
  })
})
