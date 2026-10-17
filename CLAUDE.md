# Sana's Boutique

> "Sana's Boutique" is a temporary name. Keep it in one config place per app (backend property, frontend constant), never hard-coded in strings or copy.

A web-based PWA for a boutique + parlour business expanding into franchises (2 outlets now, more later). Four modules, each with its own catalog and fields, all unified under ONE billing flow:
- Jewellery rental
- Parlour services
- Stitching orders
- Fabric sales

## Roles
| Role | Access |
|---|---|
| FRANCHISOR | Business owner. Dashboard across all outlets. |
| FRANCHISE_OWNER | Dashboard scoped to their own outlet only. |
| FRONT_DESK | Does billing. Role is planned but not confirmed, so keep roles easy to add or change (no hard-coded role checks scattered around; centralize them). |

## Tech stack (final, do not suggest alternatives)
- **Backend:** Spring Boot (Java), PostgreSQL, Flyway, Spring Security + JWT with role-based auth
- **Frontend:** React + Vite + Mantine + vite-plugin-pwa (installable, offline-capable)
- **Hosting:** GCP Cloud Run + Cloud SQL
- **CI/CD:** GitLab CI

## Schema (agreed, all tables scoped by franchise_id)
`franchise`, `app_user`, `jewellery_item`, `parlour_service`, `stitching_order`, `fabric_item`, `bill`, `bill_line_item`, `jewellery_rental`

## Hard rules

### Multi-tenancy
- Every table and query is scoped by `franchise_id`.
- For non-franchisor users, `franchise_id` comes from the JWT, never from request parameters or the request body.
- A FRANCHISE_OWNER or FRONT_DESK user must never read or write another outlet's data. **Every new endpoint gets a test proving this.**
- Only FRANCHISOR can query across outlets.

### Backend
- Schema changes only via new Flyway migrations. Never edit an applied migration.
- Layers: controller -> service -> repository. DTOs at the API boundary; never expose entities.
- `BigDecimal` for all money. Validate all input. One consistent error response format.
- Write tests for services and for the franchise-scoping rules.

### Frontend (very important)
- Users are NOT tech-savvy. Keep the UI very simple:
  - Minimal typing: prefer pickers, buttons, toggles, search-and-select.
  - Clear icons with labels. Plain language, no jargon.
  - Large touch targets; mobile and tablet first.
- Mantine components only. No other UI libraries.
- Every screen has loading, empty, and error states with friendly messages.
- Design for offline in the PWA, especially billing.

## Workflow (per feature)
Do these in order and **stop after each step for my review**:
1. Feature doc in `docs/features/<feature>.md` (purpose, screens, API, data, edge cases)
2. Flyway migration + entity
3. API (controller, service, repository, tests)
4. Frontend UI
5. Tests and a short summary of what changed

## Working agreements
- I own the repo. **NEVER** run `git commit`, `git push`, or any destructive command (`rm -rf`, dropping tables, force operations). I review and commit myself.
- Small, reviewable changes. Briefly explain design decisions; I want to understand the code.
- Quality over speed. Ask when a requirement is unclear instead of guessing.
- Record decisions in the Decisions log below.

## Decisions log
- 2026-10-11 Jewellery rental flow (`docs/features/jewellery-rental-flow.md`): staff-only pre-booking; hand-over can add pieces and change the return date; return marks every piece OK / damaged / missing with charges. Missing pieces are billed and removed from stock (booking closes). Damaged pieces: the outlet in-charge chooses back-to-stock or send-for-repair (out of stock until marked repaired). Products get an optional "Value if lost". Bills get an explicit type (BILL / CHALLAN) so challans don't count as sales. Deposits deferred.
- 2026-10-11 Outlet modules (`docs/features/outlet-modules.md`): Jewellery rental, Parlour (services only, no stock), Stitching, Shop sales (fabric + other products). Each service and each bill belongs to exactly one module; one customer visit can produce several bills. Bill numbers carry a module letter (R, P, ST; sales unchanged). A "Customer visit" screen starts from the customer and links to every module; "today's visit" is derived from today's records (no visit table). Shared services take a `module` argument; module access checked centrally.
- 2026-10-11 Stitching orders (`docs/features/stitching-orders.md`): garment name typed by the outlet; price optional at order time (required before that garment is billed); delivery date and status **per garment** (calendar; Not started / Started / Finished via dropdown, moving back allowed); **partial delivery** = one bill per delivery of selected finished garments; several advances per order, used up bill by bill (bill.advance_paid); cancel/leftover advance → outlet decides refund amount, separate refund challan; measurements "use previous" or "enter fresh"; customer receipt + work slip. No payment-mode recording (manual). Every order has an append-only log of steps and staff comments (author + time), never printed on bills.
- 2026-10-11 Parlour module (`docs/features/parlour.md`): book (date + time required, no slot limit, no advance), walk-in bill, booked customer billed on the day with services added/removed; fixed service prices, discount only; no staff name. Earlier-day bookings still Booked are cancelled per outlet at login and when Parlour is opened; no scheduler (the 6:00 AM job was switched off). Bookings end without a bill by Cancel, Cancel & reschedule (new linked booking), or the system job.
- 2026-10-11 Jewellery rental v3 (`docs/features/jewellery-rental-flow.md`): separate module with its own dashboard and bills (`-R-`); Rent now (book today + hand over in one step); days = return date − take-away date (min 1); late return = extra days only, no fine; pre-bookings not collected by their date are cancelled; price = the product's price per day. **No scheduler anywhere**: each outlet's leftover parlour appointments and rental pre-bookings are cancelled at that outlet's login and when the module screen is opened.
- 2026-10-11 Old Bookings module removed. The outlet menu shows one module per kind of service (Jewellery rental, Parlour, Stitching, Shop sales) and only the modules of services the franchisor gave the outlet; checked centrally (`ModuleAccess`), refused with 403 otherwise. Each module bills and lists its own bills; Shop sales = the old Billing page, shop products only.
- 2026-10-11 Franchisor-created billing modules (`docs/features/custom-billing-modules.md`): a service goes inside an existing module or in a new **simple billing module** (own menu item, bills, auto-generated bill code, e.g. ABC-BS-000123). Only the franchisor creates them. All module bills use fixed prices, discount only (stitching: price entered at billing).
- 2026-10-11 Dates are shown and typed as **dd/mm/yyyy** everywhere (times 12-hour, e.g. 04:35 pm). One place per app: `frontend/src/config/dateFormat.ts` (`fmtDate`, `fmtDateTime`, theme default for every `DateInput`) and backend `common/DisplayDates` for message text. The API keeps ISO `yyyy-MM-dd`. Never use `toLocaleDateString()` / `toLocaleString()` directly.
<!-- Append dated entries here. -->
