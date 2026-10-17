# Feature: Franchisor-created billing modules

Status: v2, owner answers applied (see §8). Steps 2–4 done (V22, API + tests, screens), waiting for review. Not in this round: a separate line per billing module in Reports / Analytics (their bills are counted in the totals).
Builds on `outlet-modules.md` (one module per kind of service; an outlet sees only the modules of services it was given).

## 1. Purpose
Today a service can only open one of four built-in modules: Jewellery rental, Parlour, Stitching, Shop sales. When the business adds something new (e.g. *Bangle sales*, *Mehendi*, *Saree pre-pleating*), the franchisor should be able to:
1. put the new service **inside an existing module** (e.g. Mehendi inside Parlour, so it is billed on the parlour bill), **or**
2. **create a separate billing module** for it, which then appears as its own menu item at the outlets that have the service, with its own bills.

## 2. What a new billing module is
A **simple billing module**: the same flow as Shop sales, but separate.
- Its own menu item (name + icon chosen by the franchisor).
- Its own billing screen: customer → pick items (search / scan / tap) → quantity → discount → **Complete bill**. Prices are the outlet's product prices; stock is reduced when an item tracks stock.
- Its own bill list and its own bill numbers, using a short code the franchisor picks: `ABC-BG-000123` for "Bangle sales" with code `BG`.
- Shown in Reports / Analytics as its own module.

It does **not** get bookings, hand-over / return, appointments or order tracking. Those flows exist only in the built-in modules. A new service that needs one of them goes **inside** that existing module (choice 1 above).

## 3. Screens
### Franchisor → Services → Add / Edit service
The **Module** dropdown lists:
```
Jewellery rental
Parlour
Stitching
Shop sales
── Your billing modules ──
Bangle sales                     (created earlier)
＋ Create a separate billing module…
```
Choosing **＋ Create a separate billing module…** opens a small form:
- **Module name** (e.g. "Bangle sales"), shown in the outlet menu.
- **Bill code**: made **automatically** from the name (e.g. "Bangle sales" → `BS`; if taken, `BS2`), shown before saving. Never one of the codes already used by the app (R, P, ST, DC, RF, BK).
- **Icon**: pick from a few big icons (bag, bangle/ring, flower, gift, star, tag).
- **Save** creates the module and selects it for the service.

### Franchisor → Billing modules (small list, new menu item under Services)
Name, code, icon, number of services using it, **Active** switch, **Edit** (name and icon can change; the code cannot change once bills exist). A module cannot be deleted once it has bills; switching it off hides it at all outlets.

### Outlet
- The menu shows the new module like the built-in ones, only if the outlet was given at least one active service in it.
- The page looks like Shop sales: **New bill**, Recent bills, All bills (search, date range). Loading, empty and error states as everywhere.

## 4. Data (new migration)
- New table `billing_module`: id, name (unique), code (unique, 1–3 letters), icon, is_active, created_at.
- `service.billing_module_id → billing_module` (nullable). A service is in **either** a built-in module (`service.module`) **or** a billing module: `service.module = 'CUSTOM'` with `billing_module_id` set (CHECK keeps the two consistent).
- `bill.billing_module_id → billing_module` (nullable), `bill.module = 'CUSTOM'` for those bills. Index `bill(outlet_id, billing_module_id, created_at DESC)`.
- Built-in modules stay as they are; nothing existing changes.

## 5. API
| Who | Method & path | Purpose |
|---|---|---|
| Franchisor | `GET/POST /api/billing-modules`, `PUT /api/billing-modules/{id}`, `PATCH /{id}/active` | Manage billing modules |
| Franchisor | `POST/PUT /api/services` | **Changed:** `module` may be `CUSTOM` with `billingModuleId` |
| Outlet | `GET /api/outlet/me/modules` | **Changed:** also returns the outlet's billing modules (id, name, code, icon) |
| Outlet | `GET /api/outlet/me/billing-modules/{id}/items?search=` | Items of that module for this outlet |
| Outlet | `POST /api/outlet/me/billing-modules/{id}/bills` | Make a bill (items of that module only) |
| Outlet | `GET /api/outlet/me/billing-modules/{id}/bills` · `/recent` | That module's bills |

Rules: the outlet comes from the JWT; the module must be one the outlet was given (same central check as the built-in modules, 403 otherwise); a bill may only hold items of that module; a switched-off module is refused.

## 6. Tests
- Tenancy and module access for every new outlet endpoint (another outlet's or a not-given module → refused).
- Bill holds only that module's items; numbering uses the code; stock reduced.
- Franchisor rules: unique name and code, reserved codes refused, code locked once bills exist, cannot delete with bills.
- Menu list includes billing modules only for outlets given one of their services.

## 8. Decisions (owner, 2026-10-11)
1. New modules are **simple billing modules** for now. If a client later needs a special style (e.g. pre-book or rent for one module), that module gets redesigned then.
2. The **bill code is generated automatically** from the module name.
3. **All module bills use fixed prices; only a discount is allowed.** Stitching is the exception: the garment price is entered at billing.
4. **Only the franchisor** creates billing modules.

## 7. Questions (answered in §8)
1. Is a **simple billing module** (pick items → bill, like Shop sales) what you need for new modules? Or do some new modules also need bookings or order tracking? Those would go inside the existing Parlour, Rental or Stitching module instead.
2. **Bill code** chosen by the franchisor (e.g. `BG`): OK, or should the system make one from the name?
3. Should outlets be able to **edit prices** on these bills, or are prices fixed like Parlour (discount only)? Proposed: fixed, discount only.
4. Who creates modules: **only the franchisor** (proposed), or also outlet owners?
