# End-to-end test plan — Sana's Boutique

Automated suite: `e2e/` (Playwright, **87 tests**). Findings: `docs/BUGS_AND_IMPROVEMENTS.md`.

## What was actually run (2026-10-03)

| Check | Result |
|---|---|
| Frontend type-check (`tsc -b`) | Pass |
| Frontend production build | Pass (warning: single 1.23 MB bundle) |
| Lint (`oxlint src`) | ~30 warnings, no errors |
| E2E suite compiles and lists 87 tests | Pass |
| `mock` project (5 tests, real browser, stubbed API) | 2 pass, 3 fail **on purpose** (BUG-01, BUG-02, BUG-05) |
| Fix for BUG-01 applied in a scratch copy | The BUG-01 test went green |
| `api` project (70 tests) and `ui` project (12 tests) | **Not run.** I could not reach your database or Java backend. They are written from the frontend API layer and the SQL migrations and still need a first run on your machine. |

## Setup for a full run
1. `docker compose up -d` (Postgres), start the backend on `:8080`, start the frontend with `npm run dev` (`:5173`). Use a **test** database.
2. Create the admin once through `/setup` (or have one), then put it in `e2e/.env`.
3. `cd e2e && npm install && npx playwright install chromium && npm test`.

## Coverage map

| Area | Scenarios | Where |
|---|---|---|
| **Auth** | wrong password vs unknown user give the same answer; one-time setup refused after the first admin; login form validation; sign-out blocks protected routes; expired token | `01`, `10`, `mock` |
| **Roles** | outlet token on admin endpoints → 403; admin token on outlet endpoints → clean 4xx; no token → 401 on 10 endpoints; forged/garbled tokens → 401; actuator internals not public | `05` |
| **Tenant isolation** | outlet B cannot list, open, cancel, hand over, edit or bill outlet A's customers/bills/bookings/stitching/items; report criteria cannot be widened to other outlets | `05` |
| **Catalog** | default price units; unique service names; generated item code and lookup by code; rejects negative price/quantity and blank names; deactivated item is neither searchable nor billable | `01` |
| **Outlets** | create with one-time password; duplicate mobile/email; regenerate password invalidates the old one; disabled outlet cannot log in **and its old token stops working**; outlet sees only allowed services/items | `01` |
| **Billing** | totals and discount; bill number format; customer auto-created, one customer per mobile; stock reduced by the sale and uses the **outlet** allocation, not the catalog quantity; over-stock refused without changing stock; 9 validation cases (discount > subtotal, bad mobile, empty bill, zero/negative qty, unknown item, …); **3 simultaneous sales of the last unit → exactly one wins**; 8 simultaneous bills → 8 unique numbers; unlimited items; recent/search/date filter/today total; customer spend and count | `02` |
| **Rental bookings** | availability; estimate = price × qty × days; overlap beyond stock refused; later dates allowed; 6 validation cases; list/day/middle-day visibility; reschedule; hand-over → zero-amount challan + stock out; return → minimum 1 day billed + stock back; state machine (return before hand-over, hand over twice, reschedule/cancel after hand-over); cancel frees dates; **concurrent bookings for the last piece → one wins** | `03` |
| **Appointments** | time required; complete with discount; cannot complete twice; cancelled cannot complete; discount > amount refused; service with pre-booking off refused; due booking billed together with a normal bill and cannot be billed twice | `03` |
| **Stitching** | create → IN_PROGRESS with no total; 5 validation cases; ready needs an amount for **every** garment (> 0); deliver with discount → bill; no double delivery; cannot cancel delivered; edit while open, garment count locked once READY, no edit after cancel; revenue appears in analytics | `04` |
| **Admin views** | sales summary, outlet dashboard, analytics and bill list agree; report filtered by outlet + service; reversed date range does not 500; bill search | `06` |
| **Input hardening** | SQL-looking and HTML text stored as text; huge page size capped; malformed JSON / wrong types → 400, not 500 | `05` |
| **UI flows** | create bill (search, stock limit "max 3", total, save, appears in recent); complete button rules; **BUG-01 regression**; create booking; stitching order → ready → deliver; phone-width layout has no sideways scroll | `11` |

## Assumptions inside the tests (fix the test, not the app, if one is wrong)
1. Outlet username = its mobile number.
2. Sale, rental hand-over and return change `allocatedQuantity` on `GET /outlet/me/items`.
3. Bookings: starting in the past, a rental without a return date, and an appointment without a time are all rejected. Stitching with a past delivery date is rejected.
4. `409/400/403/404` are all accepted wherever the test only says "refused"; a **5xx always fails** (a server error on bad input is a bug).
5. Page-size cap of 200.

## Manual / exploratory checks the suite cannot do
- **Printing:** print a bill and a stitching slip on the real receipt printer (72 mm). Check that the second print of the same bill does not print twice or print the page behind the modal.
- **Barcode scanner:** scan an item code into the billing search box (type + Enter).
- **Install as an app (PWA)** on Android and iPhone; after a deploy, confirm the new version loads without closing every tab (BUG-03, BUG-04).
- **Session expiry:** sign in, wait out the token (or shorten `JWT_ACCESS_TTL_MIN` to 1), then bill. Expect a redirect to login with a message (BUG-02).
- **Time zone:** use the app between 00:00 and 05:30 IST and compare "today's sales", "overdue" and the booking day view with the server's date (BUG-10).
- **Two phones, one item:** bill the last unit from two outlets/browsers at once (the API tests cover this per outlet; this checks the real UI).
- **Slow network:** throttle to "Slow 3G"; double-tap *Complete bill* and confirm only one bill is created.
- **Data volume:** load 10,000+ bills and check Billing → All billing, Customers, and Reports for speed (DB-4).
