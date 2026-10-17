import { expect, request, type APIRequestContext } from '@playwright/test'

/**
 * Shared helpers. Endpoints and payload shapes mirror frontend/src/api/*.ts.
 * Every test creates uniquely named data (uid()) so runs never collide, but nothing
 * is deleted afterwards: run against a TEST database, never production.
 */
export const API = (process.env.API_URL ?? 'http://localhost:8080/api').replace(/\/$/, '') + '/'
export const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? ''
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? ''

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
export const mobile10 = () => '9' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0')
export const isoDate = (offsetDays = 0) => {
  const d = new Date(); d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function anon(): Promise<APIRequestContext> {
  return request.newContext({ baseURL: API, extraHTTPHeaders: { 'Content-Type': 'application/json' } })
}

export async function authed(token: string): Promise<APIRequestContext> {
  return request.newContext({ baseURL: API, extraHTTPHeaders: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } })
}

export async function loginToken(username: string, password: string): Promise<string> {
  const ctx = await anon()
  const res = await ctx.post('auth/login', { data: { username, password } })
  expect(res.status(), `login as ${username}`).toBe(200)
  const body = await res.json()
  expect(body.accessToken).toBeTruthy()
  return body.accessToken as string
}

export async function adminApi(): Promise<APIRequestContext> {
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) throw new Error('Set ADMIN_USERNAME and ADMIN_PASSWORD in e2e/.env')
  return authed(await loginToken(ADMIN_USERNAME, ADMIN_PASSWORD))
}

export const outletLoginName = (o: { mobileNumber: string }) => o.mobileNumber

/** Creates a service (admin). */
export async function createService(admin: APIRequestContext, opts: { name: string; priceUnit: 'Flat' | 'Per Day' | 'Per Hour' | 'Per Meter' | 'Per Piece'; bookingMode?: 'RENTAL' | 'APPOINTMENT' | 'DELIVERY' | null; prebookEnabled?: boolean }) {
  const units = await (await admin.get('price-units')).json() as { id: number; name: string }[]
  const unit = units.find((u) => u.name === opts.priceUnit)
  expect(unit, `price unit ${opts.priceUnit} exists`).toBeTruthy()
  const res = await admin.post('services', { data: { name: opts.name, description: 'e2e', priceUnitId: unit!.id, bookingMode: opts.bookingMode ?? null, prebookEnabled: opts.prebookEnabled ?? false } })
  expect(res.status(), 'create service').toBeLessThan(300)
  return await res.json() as { id: number; name: string }
}

export async function createItem(admin: APIRequestContext, serviceId: number, opts: { name: string; price: number; quantity?: number | null }) {
  const res = await admin.post(`services/${serviceId}/items`, { data: { name: opts.name, description: 'e2e', price: opts.price, quantity: opts.quantity ?? null } })
  expect(res.status(), 'create item').toBeLessThan(300)
  return await res.json() as { id: number; itemCode: string | null; name: string; quantity: number | null }
}

export async function createOutlet(admin: APIRequestContext, label = 'E2E Outlet') {
  const id = uid()
  const payload = { name: `${label} ${id}`, ownerName: 'E2E Owner', address: '1 Test Street', mobileNumber: mobile10(), email: `e2e-${id}@example.test` }
  const res = await admin.post('outlets', { data: payload })
  expect(res.status(), 'create outlet').toBeLessThan(300)
  const body = await res.json() as { id: number; mobileNumber: string; generatedPassword: string }
  return { ...body, payload }
}

export async function allowService(admin: APIRequestContext, outletId: number, serviceId: number) {
  const res = await admin.patch(`outlets/${outletId}/services/${serviceId}`, { data: { allowed: true } })
  expect(res.status(), 'allow service').toBeLessThan(300)
}

export async function allowItem(admin: APIRequestContext, outletId: number, serviceId: number, itemId: number, allocatedQuantity: number | null) {
  const res = await admin.patch(`outlets/${outletId}/services/${serviceId}/items/${itemId}`, { data: { allowed: true, allocatedQuantity } })
  expect(res.status(), 'allow item').toBeLessThan(300)
}

/** Admin-side setup: a service with one item, assigned to a fresh outlet. Returns an authed outlet context too. */
export async function outletWithStock(admin: APIRequestContext, opts: { unit?: 'Flat' | 'Per Day'; bookingMode?: 'RENTAL' | 'APPOINTMENT' | 'DELIVERY' | null; prebook?: boolean; price: number; stock: number | null; allocated?: number | null } ) {
  const tag = uid()
  const service = await createService(admin, { name: `E2E Service ${tag}`, priceUnit: opts.unit ?? 'Flat', bookingMode: opts.bookingMode ?? null, prebookEnabled: opts.prebook ?? false })
  const item = await createItem(admin, service.id, { name: `E2E Item ${tag}`, price: opts.price, quantity: opts.stock })
  const outlet = await createOutlet(admin)
  await allowService(admin, outlet.id, service.id)
  await allowItem(admin, outlet.id, service.id, item.id, opts.allocated === undefined ? opts.stock : opts.allocated)
  const token = await loginToken(outletLoginName(outlet), outlet.generatedPassword)
  const api = await authed(token)
  return { service, item, outlet, token, api }
}

export const money = (n: number) => Math.round(n * 100) / 100
