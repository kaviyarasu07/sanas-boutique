# Feature: Separate outlet modules (Jewellery rental, Parlour, Shop sales)

Status: v3, approved by owner (incl. removing the "Delivery" booking option). Step 2 (migration + entities) in progress.
Builds on: `jewellery-rental-flow.md` (that flow now lives inside the Jewellery rental module).

## 1. Problem
Today an outlet has **one Billing page** and **one Bookings page** shared by every kind of work. For a non-technical in-charge this means:
- The billing search mixes jewellery, parlour services and fabric, so it is easy to pick the wrong thing.
- One bill can mix a parlour facial, a rental challan line and fabric, so it is hard to explain to the customer or to read in reports.
- Rental hand-over can be done from the Billing page, which skips the rental steps (add pieces, checklist, return date).
- The Bookings page mixes rentals (date range, hand-over, return) with appointments (date + time), so the buttons change from row to row.

## 2. Goal
Each line of business is **its own module with its own screens and its own bills**. Inside a module the in-charge does everything for that business without leaving it.

| Module | What the in-charge does there | Bills from here |
|---|---|---|
| 💎 **Jewellery rental** | Book, hand over (challan), return & bill, under repair, search bookings, rental bills | Rental bills (on return) + challans |
| 💆 **Parlour** | Walk-in bill, book appointment, today's appointments, search bookings, parlour bills | Parlour bills |
| ✂️ **Stitching** | New order (receipt + advance), status Not started → Started → Finished, due today, deliver & bill (advance deducted). See `stitching-orders.md` | Stitching bills
| 🛍 **Shop sales** (today's "Billing", renamed) | Sell fabric and other products | Sales bills |

Shared across modules (unchanged): **Customers**, **Products**, **Check price**, **Reports**, **Analytics**, **Overview**.

### Non-goals
- No change to how rental pricing, availability, stock or the return check work (see `jewellery-rental-flow.md`).
- No per-module staff logins yet. The design leaves a hook for it (section 7).
- No combined "one bill for everything". That is the point of the change.

## 3. Key decisions (proposed)
1. **A service belongs to exactly one module.** The admin sets it on the service: `Jewellery rental`, `Parlour` or `Shop sales`. This replaces the current indirect settings (`booking_mode` + "can be pre-booked" toggle + the "Per Day" guess) with one clear choice.
   - Jewellery rental ⇒ items are rented by date range (today's RENTAL behaviour).
   - Parlour ⇒ items are services with an optional appointment (today's APPOINTMENT behaviour).
   - Shop sales ⇒ items are sold, not pre-booked.
2. **Every bill belongs to exactly one module.** A bill can only contain items of its own module. The server enforces this; the pickers only show that module's items.
3. **A customer using two modules in one visit gets two bills** (e.g. a facial + a necklace rental). Each is short and clear. Customers, their history and reports are still shared.
4. **One shared engine, thin module screens.** Billing, booking, stock and numbering logic stay in the existing shared services, which take a `module` argument. Each module adds its own small controller and screens. No copy-pasted billing code per module.
5. **Module names, icons and order live in one config place** (backend enum + frontend `config/modules.ts`), like the brand name.
6. **A module only shows for an outlet if the outlet has at least one active service in it.** An outlet without parlour services never sees the Parlour menu.

## 4. Screens

### Navigation (outlet)
```
Overview
💎 Jewellery rental
💆 Parlour
✂️ Stitching
🛍 Shop sales
──────────
Customers · Products · Check price · Reports · Analytics
```
The old **Bookings** and **Billing** menu items go away (their work moves into the modules). The top-bar "Create new bill" button becomes a small menu: **Parlour bill** / **Shop sale** (rental bills are only made at return).

### 💎 Jewellery rental module
Big tiles at the top with live counts, then the chosen screen below:
```
[ 📅 Book ] [ 🤝 Hand over · 3 ] [ ↩ Return · 2 due · 1 late ] [ 🔧 Under repair · 1 ] [ 🔍 Find booking ] [ 🧾 Bills ]
```
- **Book / Hand over / Return / Under repair**: exactly as in `jewellery-rental-flow.md`.
- **Walk-in rental** (customer wants to take it now, no pre-booking): **Book** with today's date → saving goes straight to the hand-over screen.
- **Find booking**: one search box (mobile, name, booking no., challan no., scan) + filter chips `Booked · With customer · Completed · Cancelled`.
- **Bills**: rental bills and challans only, with search by number and date.

### 💆 Parlour module
```
[ 🧾 New bill ] [ 📅 Book appointment ] [ 🕑 Today · 6 ] [ 🔍 Find booking ] [ 🧾 Bills ]
```
- **New bill (walk-in)**: customer mobile → tap services from a **grid of big service buttons** (grouped by service, e.g. Facial, Hair, Bridal), quantity +/−, discount, **Complete bill**. No stock, no typing beyond the mobile number.
- **Book appointment**: customer → services → date → time (picker with 15-minute slots) → **Save**. Prints/shares a small appointment slip.
- **Today**: today's appointments in time order as big cards (time, customer, services). Each card has:
  - **Customer arrived → Bill**: opens New bill pre-filled with the booked services. The in-charge can **add or remove services**, then completes the bill. The appointment is marked done and linked to the bill.
  - **Change time** / **Didn't come** (cancels with reason "No-show", kept for history).
  - Date arrows to see other days.
- **Find booking**: search by mobile, name or booking no. + filter chips `Booked · Done · Cancelled`.
- **Bills**: parlour bills only.

### 🛍 Shop sales (today's Billing page, narrowed)
- Same screen as today, but the product search shows **only Shop-sales items**, and the "Pre-booked for…" card is removed (bookings now live in their modules).

### Shared screens, small changes
- **Customer details**: bills from all modules, each with a module badge; filter chips per module.
- **Reports / Analytics / Overview**: a **Module** filter and a per-module split ("Today: Rental ₹6,900 · Parlour ₹3,200 · Sales ₹1,450"). Challans never count as sales.
- **Products**: module filter chips; jewellery items show the "Value if lost" field.
- **Admin → Services**: one **Module** picker per service (replaces "Booking mode" and "Can be pre-booked").
- **Admin dashboards (franchisor)**: same per-module split across outlets.

### States (every module screen)
Loading, empty ("No appointments today.", "Nothing to hand over today.") and friendly error with **Try again**, as per CLAUDE.md. Dates dd/mm/yyyy.

## 5. Data (new migration, V17; V16 is not edited)
- `service.module VARCHAR(20) NOT NULL` CHECK in (`RENTAL`, `PARLOUR`, `SALES`).
  Back-fill: `booking_mode = 'RENTAL'` or price unit "Per Day" or name like `%jewel%` → `RENTAL`; `booking_mode = 'APPOINTMENT'` or name like `%parlo%` → `PARLOUR`; everything else → `SALES`. The admin reviews the result once on the Services page.
- `bill.module VARCHAR(20) NOT NULL` CHECK in (`RENTAL`, `PARLOUR`, `SALES`, `STITCHING`).
  Back-fill: bills linked to a stitching order → `STITCHING`; to a rental booking → `RENTAL`; bills whose items are all from one module → that module; old **mixed** bills → `SALES` and flagged in reports as "Mixed (before modules)". Index `bill(outlet_id, module, created_at DESC)`.
- `stitch_order.fabric_bill_id BIGINT NULL REFERENCES bill(id)`: fabric bought here for this order (section 12).
- `booking` needs no new column: its module follows from its kind (RENTAL → Jewellery rental, APPOINTMENT → Parlour).
- `service.booking_mode` and `service.prebook_enabled` stop being used by the app. They are **not dropped** in V17 (safe rollback); a later migration can drop them.
- **Bill numbers** get a module letter so staff can tell bills apart at a glance: `ABC-R-000251` (rental), `ABC-P-000252` (parlour), `ABC-ST-000253` (stitching), `ABC-000254` (shop sales, unchanged). Old bill numbers are not changed. (Question 2.)

## 6. API
The outlet always comes from the JWT, never from the request (unchanged). Shared services gain a `module` parameter; each module gets a thin controller.

| Path | Purpose |
|---|---|
| `/api/outlet/me/modules` | **New.** Modules this outlet can use (has active services in), for the menu |
| `/api/outlet/me/items?module=…` | **Changed.** Item search filtered to one module (used by every picker) |
| `/api/outlet/me/rental/bookings/...` | Rental bookings: create, list/search, lookup, hand-overs due, returns due, hand-over, return, cancel, reschedule (moved from `/bookings`, rental-only) |
| `/api/outlet/me/rental/repairs/...` | Under repair list, back in stock |
| `/api/outlet/me/rental/bills` | Rental bills + challans (list, search) |
| `/api/outlet/me/parlour/bills` | Create a parlour bill (optionally `bookingIds` of today's appointments), list, search |
| `/api/outlet/me/parlour/appointments/...` | Create, day list, search, reschedule, no-show/cancel |
| `/api/outlet/me/bills` | **Narrowed** to Shop sales; rejects rental/parlour items and `bookingIds` |
| `/api/outlet/me/bills/report`, `/analytics`, `/today-total` | **Changed.** Optional `module` filter + per-module totals |

Rules enforced on the server:
- An item can only go on a bill (or booking) of its own module → otherwise "*Facial* is a Parlour service. Bill it in Parlour."
- A parlour endpoint can never act on a rental booking and vice versa (404, as if it does not exist).
- The old `/api/outlet/me/bookings` endpoints are kept for one release, read-only, so an installed PWA that has not updated yet does not break; then removed.

## 7. Roles and permissions (hook, not built now)
Module access is checked in **one central place** (`ModuleAccess.canUse(user, module)`), called by every module controller. Today it returns "yes" for any OUTLET user. When FRONT_DESK logins arrive, giving a parlour receptionist access to Parlour only is a change in that one place plus a setting per user. No role checks scattered in controllers (CLAUDE.md rule).

## 8. Tests
- **Tenancy (every new endpoint):** outlet A cannot list, look up, bill, hand over, return or book on outlet B's data.
- **Module separation:** parlour bill with a rental item → rejected; shop sale with a parlour service → rejected; parlour endpoint with a rental booking id → 404; rental endpoint with an appointment id → 404.
- **Back-fill:** services and bills land in the right module; mixed old bills become `SALES`.
- **Reports:** per-module totals add up to the overall total; challans excluded.
- **Menu:** an outlet with no parlour services gets no Parlour module.

## 9. Rollout (small reviewable steps)
1. Migration V17 + entities (module on service and bill).
2. Backend: module-aware shared services, module controllers, tests.
3. Frontend: navigation + Parlour module + Shop sales narrowing.
4. Frontend: Jewellery rental module (the rental flow screens from `jewellery-rental-flow.md` are built here directly, not on the old Bookings page).
5. Reports / analytics / admin per-module split; admin Services module picker.
6. Remove old Bookings page and the old `/bookings` endpoints after one release.

## 10. Risks
| Risk | Mitigation |
|---|---|
| Back-fill puts a service in the wrong module | Admin reviews the Services page once; changing a service's module is one click and affects only new bills |
| Staff used to the old Billing/Bookings pages | Old menu items show a one-time note "Bookings moved to Jewellery rental and Parlour" for one release |
| Customer wants one bill for a parlour + rental visit | Two bills by design (decision 3); both print one after the other |
| Installed PWA on old version calls removed endpoints | Old endpoints kept read-only for one release; service-worker update fix (BUG-04) should land first |

## 11. Decisions (confirmed by owner, 2026-10-11)
1. **Separate bills per module**, even in one visit. The "Customer visit" screen (section 12) ties them together for the customer.
2. **Bill number letters** per module: `ABC-R-…` rental, `ABC-P-…` parlour, `ABC-ST-…` stitching, shop sales unchanged.
3. **Parlour walk-in billing** uses a grid of big service buttons.
4. *(Open, re-asked in plain words: can the "Delivery" booking option be removed? See section 13.)*
5. **Fabric stays in Shop sales** with other products.
6. **Parlour is services only.** No stock, no products. Parlour bills can only hold parlour services.

## 12. Customer visit: one customer, several modules, one visit

### The situation
A customer walks in and, in one visit:
1. gets a **parlour service** → needs a **bill**
2. **pre-books jewellery** → booking slip, no bill yet
3. places a **stitching order** → order details kept, billed on delivery
4. **buys fabric** for that stitching → needs a **bill**
5. **pre-books the next parlour service** → appointment slip, no bill yet

The in-charge should type the customer's mobile **once** and finish the whole visit from one screen, in **any order**.

### Design: start from the customer, not from the module
A big **🔍 Customer** button sits in the top bar on every screen (next to "Create new bill"). Type the mobile → the **Customer visit** screen opens (new customer: type the name once).

```
┌───────────────────────────────────────────────────────────────┐
│ Priya · 98765 43210                       [ Finish visit ✔ ]  │
├───────────────────────────────────────────────────────────────┤
│ What would she like?                                          │
│ [💆 Parlour bill] [📅 Book parlour] [💎 Book jewellery]        │
│ [✂️ Stitching order] [🛍 Buy products]                         │
├───────────────────────────────────────────────────────────────┤
│ Today's visit                                                 │
│ ✓ Parlour bill   ABC-P-000301   Facial, Threading     ₹900    │
│ ✓ Jewellery booked  ABC-BK-000124  14/10 → 16/10  est. ₹2,000 │
│ ✓ Shop bill      ABC-000302     Silk fabric 2.5 m   ₹1,250    │
│ ✓ Stitching order STC-000045  Blouse ₹800 · advance ₹500       │
│ ✓ Parlour booked  14/10/2026 10:00  Bridal makeup             │
├───────────────────────────────────────────────────────────────┤
│ Coming up: jewellery hand-over 14/10 · stitching due 25/10    │
└───────────────────────────────────────────────────────────────┘
```

- Each action button opens **that module's normal screen with the customer already filled in**. When it is saved, the in-charge lands back on this screen and the new line appears under **Today's visit**.
- Order is free: the in-charge follows the customer, not the software.
- **Finish visit** shows a summary and prints **one visit receipt**:
  ```
  TO PAY NOW
    Parlour bill  ABC-P-000301      ₹900
    Shop bill     ABC-000302      ₹1,250
    Stitching advance STC-000045    ₹500
    Total                         ₹2,650
  BOOKED (pay later)
    Jewellery 14/10/2026 → 16/10/2026   estimate ₹2,000
    Parlour   14/10/2026 10:00           Bridal makeup
  ORDERS
    Stitching STC-000045  Blouse ₹800, advance ₹500 paid, balance ₹300 on delivery 25/10/2026
  ```
  The individual bills stay separate (decision 1); the visit receipt just lists them together so the customer pays one total and takes one paper. Each bill can still be reprinted on its own.

### Linking fabric to the stitching order
On the stitching order screen, a **Fabric** choice: `Customer's own fabric` / `Bought here today`. If a shop bill was made in this visit, it is offered automatically ("Silk fabric 2.5 m, bill ABC-000302") and saved on the order, so the tailor knows the fabric is paid for and which one it is. Optional, one tap.

### Walk-through with taps
| Step | In-charge taps | Typing |
|---|---|---|
| 1 | 🔍 Customer → mobile | mobile once (+ name if new) |
| 2 | 💆 Parlour bill → Facial, Threading → Complete bill | none |
| 3 | 💎 Book jewellery → scan/search necklace → dates → Save | none (scan) or a search word |
| 4 | 🛍 Buy products → scan fabric → quantity 2.5 → Complete bill | quantity |
| 5 | ✂️ Stitching order → Blouse → measurements → delivery date → Fabric: "Bought here today" ✓ → Save | measurements |
| 6 | 📅 Book parlour → Bridal makeup → 14/10 → 10:00 → Save | none |
| 7 | Finish visit → Print | none |

### How it works (technical)
- **No new "visit" table.** "Today's visit" is simply everything for this customer at this outlet created today: bills, bookings, stitching orders. It survives a page refresh, a second device and a crash mid-visit, and needs no "start/end visit" bookkeeping.
- New endpoint `GET /api/outlet/me/customers/{id}/today`: today's bills (all modules), bookings and stitching orders for that customer, plus upcoming bookings/orders. Outlet from the JWT; tenancy test as usual.
- Module screens accept a pre-selected customer (route state), and return to the visit screen after saving when opened from it.
- Visit receipt = a print view over the existing bills; no new bill is created.
- Fabric link: new nullable `stitch_order.fabric_bill_id` (FK to `bill`, must be the same outlet and customer, module `SALES`). Added to the V17 migration.
- No payment recording yet (payment mode is a separate later feature). "To pay now" is the sum of today's bills plus advances taken today (stitching), see `stitching-orders.md` §8.

## 14. Built (owner, 2026-10-11)
- **Bookings module removed.** Bookings are made only in Jewellery rental and Parlour. The old /api/outlet/me/bookings keeps two read-only lists (day, overdue) for the Overview schedule.
- **One module per kind of service**: each service has a Module (Jewellery rental, Parlour, **Stitching**, Shop sales), set by the franchisor on the Services screen. Stitching became a service module (V21) so it can be given to an outlet like the others.
- **An outlet sees only the modules of the services the franchisor gave it** (`GET /api/outlet/me/modules`). Every module endpoint checks this in one place (`ModuleAccess`) and refuses others with 403; the menu, the routes and the API agree.
- **Each module has its own billing**: Shop sales (the old Billing page) bills only shop products and lists only shop bills; Rental, Parlour and Stitching bill and list their own.

## 13. Delivery booking option
Removed (owner, 2026-10-11). The service "booking type" is replaced by the Module choice; old Delivery bookings, if any, stay visible read-only in customer history.
