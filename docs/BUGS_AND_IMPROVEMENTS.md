# Sana's Boutique — Bugs & Improvements

Review date: 2026-10-03. Scope: database migrations V1–V13, `application.yml`, `docker-compose.yml`, the whole React frontend, and the build/PWA output.

## How much of this is verified

| Tag | Meaning |
|---|---|
| **[Reproduced]** | I ran the frontend in a real browser (Chromium, Playwright) with a stubbed API and watched it happen. A control run with the fix applied behaved correctly. |
| **[Code]** | Visible by reading the code or build output, not run end to end. |
| **[Verify]** | A risk that depends on the Java backend. **I could not read the Java source** (files are nested too deep for my file-copy tool), and I could not run the backend. These need a check on your side. The matching test is in `e2e/`. |

Also checked: `tsc -b` passes with no errors, and `vite build` succeeds. `oxlint` reports about 30 warnings (listed under Code quality).

---

## 1. Bugs

### BUG-01 — High — Pre-booked items never appear when billing a customer **[Reproduced]**
`frontend/src/pages/outlet/BillingPage.tsx:35`

```ts
if (/^d{10}$/.test(mobile)) void loadDue(mobile) ...      // current: missing backslash, matches the letter "d" ten times
if (/^\d{10}$/.test(mobile)) void loadDue(mobile) ...     // fix
```
- **Effect:** Typing a valid 10-digit mobile in "Create new bill" never calls `GET /outlet/me/bookings/due`. The blue "Pre-booked for …" card never shows. Staff cannot add a due appointment or delivery to a bill, or hand over a rental from the billing screen. They have to go to the Bookings page instead.
- **Evidence:** Zero `bookings/due` requests were made. With the one-character fix the request is made and the card shows.
- **Test:** `tests/mock/…BUG-01` (red now, green after the fix), and `tests/ui/11-billing…REGRESSION BUG-01` against the real backend.

### BUG-02 — High — An expired session leaves a broken page that looks like empty data **[Reproduced]**
`frontend/src/api/client.ts`, `routes/RequireAuth.tsx`, and many `.catch(() => undefined)` calls.
- **What happens:** The 12-hour token expires mid-shift. The 401 handler deletes only `accessToken`. The page stays where it is. Every list swallows the error, so Billing shows **"No bills created yet."** The `role` key stays in localStorage. The next action fails with the generic "Something went wrong".
- **Impact:** Staff think the day's bills vanished, and may create duplicates.
- **Fix:** In the response interceptor, on 401 call `clearSession()` (all four keys) and `window.location.assign('/login')`. Replace the silent `.catch(() => undefined)` calls with a shared helper that shows the error.
- **Test:** `tests/mock/…BUG-02` (red now).

### BUG-03 — Medium — PWA icons are missing, so the app cannot be installed properly **[Code, confirmed in build output]**
`vite.config.ts` lists `pwa-192x192.png`, `pwa-512x512.png` and `apple-touch-icon.png`. `frontend/public/` contains only `favicon.svg`, and the built `dist/` has no PNGs. Browsers will not offer "Install app" without valid icons, and iPhones show a blank icon. Add the three PNGs to `public/`.

### BUG-04 — Medium — New versions of the app may never reach staff's phones **[Code]**
- `src/sw.js` has `clientsClaim()` but no `self.skipWaiting()` or `SKIP_WAITING` message handler (the built `dist/sw.js` contains no `skipWaiting`). With `registerType: 'autoUpdate'` and a custom service worker, the update stays "waiting" until every tab is closed. A POS app that is never fully closed will keep running old billing code after you deploy a fix.
- The `workbox: { navigateFallbackDenylist, runtimeCaching }` block in `vite.config.ts` only applies to `generateSW` mode. The project uses `injectManifest`, so it does nothing, and the comment "never cache API calls" is not what protects you. Today nothing caches `/api` only because `sw.js` has no runtime routes.
- **Fix:** add `self.skipWaiting()` (or a message listener) to `sw.js`. Delete the dead `workbox` block, or move its intent into `sw.js` explicitly (a `NavigationRoute` that skips `/api`).

### BUG-05 — Medium — Wrong-role users are sent to the login form **[Reproduced]**
`routes/RequireRole.tsx`. An OUTLET user who opens `/dashboard` (or an admin who opens `/outlet`) is redirected to `/login`. That looks like they were logged out. `LoginPage` also does not forward an already signed-in user to their home. Redirect to the role's own home instead (`OUTLET` → `/outlet`, `FRANCHISOR` → `/dashboard`) and make `/login` do the same when a valid session exists.
- **Test:** `tests/mock/…BUG-05` (red now).

### BUG-06 — Medium — Reports and dashboards show different totals whenever a discount was given **[Code, one note in the UI confirms it]**
`ReportBuilder.tsx` footnote: "Totals are item line totals **before** bill-level discounts." The dashboards and analytics use bill totals **after** discount. For the same day and outlet the two screens disagree by the total discount, and there is no way to see that difference on screen. Add a "Discounts" and "Net sales" line to the report, or switch to net. The API test `analytics and report use different definitions` documents the current behaviour.

### BUG-07 — Medium — Duplicate React keys and string-matching on bill lines **[Code]**
- `BillDetailsModal.tsx` and the print block key lines by `${itemName}-${itemCode}`. Stitching bill lines have no item code, so two garments with the same name (two "Blouse") collide: React warns, and a row can be dropped or duplicated when the list changes. Use the line's `id` or the index.
- `isChallan()` decides "this is a delivery challan" by checking whether every line name contains the text `(rental hand-over`. Renaming that text, or an item literally named that way, flips the title. Return an explicit `type: 'CHALLAN' | 'BILL'` from the API.

### BUG-08 — Medium — Lists can show stale data after fast clicks **[Code]**
`BookingsPage.tsx` and `StitchingPage.tsx`: one effect resets `page` to 0, and another loads with `[tab, search, page]`. After switching tab from page 3, the first request uses page 3 of the *new* tab, then a second request fires. Neither request is cancelled, so whichever finishes last wins. A slow old response can overwrite the right one. Reset the page in the same state update that changes the tab, and ignore responses from outdated effects (as `CustomerPicker` already does with a `cancelled` flag).

### BUG-09 — Low/Medium — Mobile-number rules disagree across the app **[Code]**
| Place | Rule |
|---|---|
| Admin first-time setup | exactly 10 digits |
| Create/edit outlet (form) | **7–15** digits |
| Customers, bookings, stitching (`outlet_customer`, `booking`, `stitch_order` columns) | exactly 10 digits (DB constraint on `outlet_customer`) |
| `bill.customer_mobile` | `VARCHAR(15)` |
Pick one rule (10-digit Indian mobile, or a proper E.164 field) and use it everywhere, including the DB.

### BUG-10 — Low — "Today" can be wrong around midnight **[Code + Verify]**
The frontend computes today in the browser's local time (good, and commented). The Overview page loads "today" once and never refreshes it, so a tab left open overnight shows yesterday's schedule. **[Verify]** Check that the backend uses `Asia/Kolkata` for "today", overdue, and monthly totals. On Cloud Run the default is UTC, which would give wrong results between 00:00 and 05:30 IST.

### BUG-11 — Low — Dead and placeholder screens **[Code]**
`pages/admin/ServicesPage.tsx` (unused "coming soon"), `pages/dashboard/DashboardPage.tsx`, `pages/outlet/OutletModulePage.tsx`, `pages/admin/catalog/CategoryManagerModal.tsx` (a 276-byte stub, categories were removed in V6) are not used by any route. **Settings** is a visible nav item that opens "coming soon". Remove the dead files and hide Settings until it exists.

### BUG-12 — Low — Small UX problems **[Code]**
- Destructive actions use `window.confirm` (blocks the page, looks bad in an installed PWA, some phone browsers suppress it). Use a Mantine confirm modal.
- Receipts print with `window.print()` after a fixed 150 ms timer. On slow devices the print can happen before the bill is rendered. Print from an effect that runs after the bill is on screen.
- Table rows that open bill details are clickable `<tr>`s with no keyboard support or role.
- `extractErrorMessage` is copy-pasted in 3 files.
- Money is multiplied in JavaScript floating point (`price * qty`). Display is rounded, but totals can differ from the server by a paisa. Use integer paise or a decimal library.

---

## 2. Database findings (from the 13 migrations) **[Code]**

| # | Finding | Suggested fix |
|---|---|---|
| DB-1 | **No stock-integrity constraints at the DB level.** Stock lives in `outlet_service_item.allocated_quantity` and `service_item.quantity`; correctness depends entirely on application code. | Row-level locking (`SELECT … FOR UPDATE`) in the service, plus a stock movement ledger (see §5). **[Verify]** `02-billing…last unit` test. |
| DB-2 | **No protection against double-booking a rental** (V10). Availability is checked, then the row is inserted; two simultaneous requests can both pass. | Lock the item row while checking and inserting, or add a per-day reservation table with a unique constraint. **[Verify]** `03-bookings…concurrent` test. |
| DB-3 | **Missing CHECK constraints:** `bill.discount <= subtotal`, `bill.total >= 0`, `service_item.price >= 0`, `bill_item.unit_price >= 0`, `stitch_item.amount > 0`. | Add as a new migration (never edit applied ones). |
| DB-4 | **Missing indexes:** `bill_item(bill_id)`, `bill(customer_id)`, `booking(customer_id)`, `booking(outlet_id, status)`, `stitch_order(outlet_id, status)`, and a trigram index for the item/customer name search. | Add; matters once a busy outlet has tens of thousands of bills. |
| DB-5 | V9 added `bill.customer_id` without back-filling bills created in V8–V9. Any such rows have `NULL` customer, so customer spend and bill counts are low. | One-off `UPDATE bill SET customer_id = …` matching on outlet + mobile. Harmless if you have no data from that window. |
| DB-6 | V12 turns on pre-booking by guessing from service **names** (`LIKE '%jewel%'`, `'%parlo%'`). | Fine as a one-off, but anything named differently was silently left off. |
| DB-7 | V1's comment says every tenant table has `franchise_id`; in reality tenancy is `outlet_id` (V7+). V7 makes `outlet.franchise_id UNIQUE`, so a franchise can only ever have one outlet. | Decide whether "franchise" and "outlet" are the same thing. If so, drop one; update the comment. |
| DB-8 | `app_user.role` allows `FRANCHISE_OWNER` and `STAFF`, but there is no screen or route for them. | Either build them (see §5) or remove them from the CHECK. |
| DB-9 | `bill` has no payment mode, no creator, no tax breakup, and no cancelled/returned state. | See §5. |
| DB-10 | `bill_item.service_item_id` became nullable in V13 for stitching lines. **[Verify]** that service-wise reports and analytics don't silently drop or mis-group stitching revenue (`service_label` only). |
| DB-11 | `flyway.baseline-on-migrate: true` can mark an existing, non-empty database as "already migrated" without running anything. | Turn off outside local dev. |

---

## 3. Security & configuration

| # | Finding | Severity |
|---|---|---|
| SEC-1 | **Dev secrets are the defaults.** If `JWT_SECRET`, `DB_PASSWORD` are missing in production, the app starts with `dev-only-change-me…` and `sanas_local_dev`. Anyone who reads the repo can then forge an admin token. | High |
| SEC-2 | **Disabled outlet's token keeps working until it expires (12 h)** unless the backend re-checks the user on every request. **[Verify]** `01-catalog…disabled outlet` test. | High if it fails |
| SEC-3 | JWT stored in `localStorage` (readable by any XSS). Stored customer names are rendered by React (escaped), which is good; keep it that way (no `dangerouslySetInnerHTML`). Consider an httpOnly cookie later. | Medium |
| SEC-4 | `refresh-token-ttl-days` is configured but the code comments say there is no refresh flow. Staff are signed out after exactly 12 h, with the problem described in BUG-02. | Medium |
| SEC-5 | No visible login rate-limit or lockout. Outlet passwords are machine-generated, which helps, but the admin password is user-chosen. **[Verify]** | Medium |
| SEC-6 | `/auth/setup` is only protected by "no admin exists yet". Between first deploy and first setup, anyone who finds the URL can become the admin. Also a race if two requests arrive together. **[Verify]** Do setup immediately on deploy, or require a setup token from an env var. | Medium |
| SEC-7 | `docker-compose.yml` publishes Postgres on `5432` with a known password and uses the obsolete `version:` key. Fine for local; make sure it is never used on a server. | Low |
| SEC-8 | `.gitignore` ignores `backend/.mvn/` but also tries to un-ignore the wrapper jar (`!.mvn/wrapper/maven-wrapper.jar`, wrong path). There is no `mvnw` in the repo, so a fresh clone or CI needs Maven installed. | Low |

---

## 4. Engineering & process

- **README promises things that don't exist.** `docs/api` (OpenAPI "source of truth"), `docs/design`, `docs/decisions` are empty (`.gitkeep`), and there is no `.gitlab-ci.yml` although the README says GitLab CI.
- **Tests:** backend has one test (`BackendApplicationTests`, context loads). Frontend has none and no test runner. The new `e2e/` project is the first real coverage.
- **Bundle size:** one 1.23 MB JavaScript file (365 KB gzipped) loaded on the login page. Add route-level `React.lazy` (admin, reports, charts).
- **Readability:** `BillingPage.tsx` and `outletApi.ts` are written as very long single-line statements. Add Prettier and format once; it will make reviews and bug-finding much easier.
- **Lint (oxlint, ~30 warnings):** `react-hooks/exhaustive-deps` in `BillingPage` and `OutletDetailPage`; "setState in effect" in 9 files; `Date` used during render in `ReportBuilder` and `LandingPage`; components files that also export constants (hurts hot reload).

---

## 5. Improvements worth building (ranked for a boutique + parlour shop)

**Do first (daily pain / money at risk)**
1. Fix BUG-01, BUG-02, SEC-1 (a day of work in total).
2. **Bill cancel / return / refund.** Today a wrong bill cannot be corrected (no void state in the schema). Add a reversing entry that puts stock back and shows in reports.
3. **Payment mode** (cash / UPI / card / part-payment) and a **daily cash-up report**.
4. **GST / tax lines** and a proper invoice number series, if the shops are GST-registered.
5. **Advance / deposit for bookings and stitching orders**, and a **security deposit + late fee for rentals**. Today the rental charge is price × days between hand-over and return, with no extra charge for returning after the expected date.
6. **Barcode-scan flow:** when the search text exactly matches an `itemCode`, add the item immediately (the endpoint `service-items/by-code/{code}` already exists). A scanner types the code and presses Enter; today staff must then click Add.

**Next**
7. **Per-staff logins** (the `STAFF` / `FRANCHISE_OWNER` roles already exist in the schema) so each bill records who made it.
8. **Stock movement ledger** (sale, return, rental out/in, adjustment) with low-stock alerts. This also solves DB-1 and audit questions.
9. **Share the bill by WhatsApp/SMS** and send reminders: rental return due, stitching ready, appointment tomorrow.
10. **Customer page upgrades:** notes, birthday, measurements saved per customer (stitching measurements are free text per order today and have to be re-typed).
11. **Server-side pagination and search everywhere** (the outlet list filters in the browser; report preview caps at 100 rows).
12. **Consistent confirm dialogs and error messages**; a visible "You are offline / session expired" banner.

**Later**
13. Offline-tolerant billing (queue bills when the network drops), with an explicit conflict strategy (the PWA is online-only by design today).
14. Tamil/English UI toggle for front-desk staff.
15. Thermal-printer templates (the current print CSS is a 72 mm block; add 58 mm and a PDF option).
16. Admin audit log (who changed prices, allocations, or disabled an outlet).

---

## 6. Suggested order of work
1. BUG-01, BUG-02, BUG-05 (frontend, small), SEC-1 (config).
2. Run the full `e2e/` suite against a test database and triage anything red under SEC-2, DB-1, DB-2, BUG-10. Those are the ones I could not check.
3. BUG-03, BUG-04 (PWA), then DB-3/DB-4 in one new migration.
4. Bill void/refund and payment mode, then the rest of §5.
