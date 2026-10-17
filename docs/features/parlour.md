# Feature: Parlour module (book, walk-in, do the booked service, auto-cancel, bill)

Status: v2, owner answers applied (see §10). Steps 2–4 done (migration, API + tests, screens), waiting for review. The 6:00 AM job runs inside the app; on Cloud Run without always-on CPU, the first-use sweep covers it (owner decision).
Part of the module split in `outlet-modules.md` (Parlour is services only: no stock, no products).

## 1. Purpose
1. **Book** a parlour service for a future day and time.
2. **Walk-in**: a customer gets a service today without a booking, and is billed.
3. **Booked service on the day**: the customer arrives, the in-charge opens the booking, can add or remove services, and bills it.
4. **Not done**: at the outlet's next login (or when Parlour is opened), bookings from earlier days that were not done are cancelled. No scheduler.
5. Every parlour bill is a **Parlour bill** (`ABC-P-000123`), separate from shop, rental and stitching bills.

## 2. What already exists (reused)
| Works today | Where |
|---|---|
| Appointment bookings: customer, services, date + time; reschedule; cancel; "complete & bill" | `BookingService` (kind `APPOINTMENT`), `BookingsPage` |
| Booking number column (`booking.booking_number`) | V16 |
| Service module on every service (`service.module = PARLOUR`) and on every bill (`bill.module`) | V17 |
| Bill from a booking's services | `BillService.createForBooking` |
| Customer picker (mobile → name) | `CustomerPicker` |

Missing: a Parlour screen of its own, a walk-in bill limited to parlour services, adding/removing services when the booked customer arrives, cancel & reschedule, the 6:00 AM auto-cancel job, parlour bill numbers, a booking timeline, and a printed appointment slip.

## 3. Business flow

### A. Book for a future day
1. **Parlour → Book**.
2. Customer mobile (name fills in for a returning customer).
3. Tap services from a **grid of big buttons** grouped by service (e.g. *Facial*: Gold facial, Fruit facial; *Hair*: Hair cut, Hair spa). Each button shows the price. Tap again to add one more (e.g. 2 × threading for two people).
4. **Date** (calendar) and **time** (required; 15-minute steps, quick buttons for common times).
5. No limit per time slot; the screen just shows the day's other bookings at that time ("2 others booked at 11:00").
6. **Save & print slip**: booking number `ABC-BK-000045` + barcode, services, date, time, estimated amount.

### B. Walk-in (service today, no booking)
1. **Parlour → New bill**.
2. Mobile → services from the grid → quantity +/− → discount → **Complete bill** → Parlour bill prints.
3. No booking is created; the bill is the record.

### C. Booked customer arrives (the service on the day)
1. **Parlour → Today**: today's bookings as big cards in time order, or **scan the slip**, or search mobile / name / booking number.
2. Tap **Customer arrived → Bill**. The bill opens **pre-filled with the booked services**.
3. The in-charge can **add services** (customer wants more) or **remove** ones not done. **Prices are fixed** (the outlet's service price); only a **discount** can be given.
4. **Complete bill** → Parlour bill prints → booking **Done** (linked to the bill).

### D. Not done → cancelled by the system at the outlet's next login
- When the outlet **logs in** (or opens Parlour), every appointment dated **before today** that is still **Booked** becomes **Cancelled** with reason **"Not done by end of day"** (`auto_cancelled`), logged by "System". No scheduler (owner decision, §7).
- During the day, the **Today** screen marks bookings whose time has passed and that are not done yet ("10:30 · not done yet"), so staff can bill, reschedule or cancel them while the customer is there or reachable.

### E. Three ways a booking ends without a bill
| Who | Action | Result |
|---|---|---|
| In-charge | **Cancel** (reason: Customer cancelled / Didn't come / Other + comment) | Booking Cancelled |
| In-charge | **Cancel & reschedule** (pick new date + time) | This booking Cancelled with reason "Rescheduled to 14/10/2026 11:00 · ABC-BK-000052"; a **new booking** with the same services is created for the new date/time and prints a new slip. Both are linked; each timeline shows the other's number. |
| System | 6:00 AM job (D) | Cancelled, "Not done by end of day" |

## 4. Screens (Parlour module, mobile first)
```
[ 🧾 New bill ] [ 📅 Book ] [ 🕑 Today · 6 ] [ 🔍 Find booking ] [ 🧾 Bills ]
```
- **Today**: time-ordered cards (time, customer, services, estimate), each with **Customer arrived → Bill**, **Cancel & reschedule**, **Cancel**. Date arrows to see other days. Bookings past their time and not done are marked.
- **Find booking**: search box (booking no. / mobile / name / scan) + chips `Booked · Done · Cancelled · Not done`.
- **Booking details**: services, date/time, status, the bill (when done), and a **timeline** (created, cancelled, rescheduled, auto-cancelled, billed) with staff comments, same style as stitching.
- **New bill / Arrived bill**: bill lines (quantity +/−, remove) with an **Add a service** search-and-select box under them (no service grid; owner request), discount, total, **Complete bill**. The Book screen keeps the service grid.
- **Bills**: parlour bills only, search by number and date.
- States: loading, empty ("No bookings today."), friendly error with **Try again**. Dates dd/mm/yyyy, times 12-hour.

## 5. Data (new migration V19; earlier migrations untouched)
- `booking`: `cancel_reason VARCHAR(200)`, `cancelled_at TIMESTAMPTZ`, `auto_cancelled BOOLEAN NOT NULL DEFAULT FALSE` (reports can tell "not done" apart from customer cancellations), `rescheduled_to_id → booking` (the new booking made by "Cancel & reschedule").
- New table `booking_log` (id, outlet_id, booking_id, kind `CREATED` / `EDIT` / `DONE` / `CANCELLED` / `RESCHEDULED` / `AUTO_CANCELLED` / `COMMENT`, message, user_id, author_name, created_at). Append-only, like `stitch_order_log`. Rentals can use it later.
- Index `booking(kind, status, start_date)` for the today list and the 6:00 AM sweep.
- No change to `bill`: parlour bills are `module = PARLOUR`, numbered `PREFIX-P-000123`.

## 6. API (`/api/outlet/me/parlour`, outlet and user from the JWT)
| Method & path | Purpose |
|---|---|
| `GET /services` | Parlour services of this outlet, grouped, for the button grid |
| `POST /bills` `{ customer, lines[{itemId, qty}], discount, bookingId? }` | Walk-in bill, or the bill of an arrived booking (lines may differ from the booking) |
| `GET /bills?search&from&to&page` | Parlour bills only |
| `POST /appointments` | Book (date + time required) |
| `GET /appointments/day?date=` | The day's appointments in time order |
| `GET /appointments?status&search&page` · `GET /appointments/lookup?code=` | Find / scan |
| `GET /appointments/{id}` · `GET /{id}/log` · `POST /{id}/comments` | Details and timeline |
| `POST /appointments/{id}/cancel` `{ reason, comment? }` | Cancel |
| `POST /appointments/{id}/cancel-and-reschedule` `{ date, time }` | Cancel this booking and create the new one (same services); returns the new booking |

Rules on the server:
- Only parlour services can be booked or billed here ("*Silk saree* is not a parlour service").
- Prices on a parlour bill are always the service's price; only a discount (≤ subtotal) is accepted.
- A booking can be billed **only on its day** and only once.
- The rental and shop endpoints refuse parlour services (module rule from `outlet-modules.md`).

## 7. The system cancel: how it runs (v3: no scheduler)
- **Owner decision (2026-10-11): no scheduler.** The check runs **per outlet when that outlet logs in**, and also when the Parlour screen is opened (covers a login session that stays open past midnight).
- It cancels that outlet's appointments dated **before today (IST)** that are still **Booked**: status Cancelled, `auto_cancelled = true`, reason "Not done by end of day", one log line each by "System". The same login check also cancels rental pre-bookings not collected by their date (`jewellery-rental-flow.md`).
- **Safe to repeat**: it only touches Booked appointments of earlier days, so running it again changes nothing.
- The 6:00 AM `@Scheduled` job built first is switched off (`app.jobs.parlour-auto-cancel.enabled`, default now `false`).

## 8. Tests
- **Tenancy** (every endpoint): outlet A cannot see, scan, book against, bill, cancel, reschedule, comment on, or read the log of outlet B's appointments; the outlet sweep only touches its own rows.
- Walk-in bill: only parlour services; fixed prices; module PARLOUR; number `-P-`.
- Arrived bill: services added/removed; booking Done and linked; cannot bill twice; cannot bill on another day.
- 6:00 AM job: yesterday's Booked → Cancelled (auto); today's untouched; Done untouched; repeat is harmless; rentals untouched; "today" is IST around midnight (fixed test clock); first-use sweep only touches the caller's outlet.
- Cancel & reschedule: old Cancelled with the reason and link; new booking Booked with the same services; not into the past.
- Rental/shop endpoints refuse parlour items.

## 9. Out of scope
Advance for parlour bookings, slot limits, staff/beautician on the bill, price changes on the bill.

## 10. Decisions (owner, 2026-10-11)
1. **Time is required** for every booking (15-minute steps).
2. **No limit** per time slot.
3. **No advance** for parlour bookings.
4. **Prices are fixed** (services only, no products); only a **discount** can be given.
5. **No staff name** on the bill.
6. Earlier-day bookings not done are cancelled **at the outlet's login** (and when Parlour is opened). First built as a 6:00 AM job; **changed to no scheduler** (owner, 2026-10-11).
7. A booking ends without a bill in three ways: **Cancel** (by hand), **Cancel & reschedule** (by hand, creates the new booking), or **cancelled by the system** (6:00 AM job).
