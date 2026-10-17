# Feature: Jewellery rental flow (pre-book → hand over → return & bill)

Status: v3, owner answers applied (see "Decisions for v3"). Steps 2–4 done (V20, API + tests, screens), waiting for review. Challan numbers: PREFIX-DC-000123; rental bills: PREFIX-R-000123. Not built yet: the warning when a missing or repair piece leaves a later booking short of stock (edge case below). v2 decisions still apply; v3 adds the separate module, "Rent now" and the check at login (see "What's new in v3"). Database: V16 + V19 already hold almost everything; one small migration (V20) is added.

## Purpose
Make the full jewellery rental journey simple for outlet staff:

1. **Pre-book.** Reserve pieces for a customer for a date range. Nobody else can book those pieces for those days.
2. **Hand over** (on the start date). Find the booking fast, hand over the pieces, **add more jewellery** if the customer wants, set the **return date**, and show the **estimated cost**.
3. **Return & bill** (on the return date). Find the booking, **check every piece that was given against what came back**, add **damage** and **missing** charges, and generate the bill.

## What's new in v3 (owner request, 2026-10-11)
1. **Separate module** "Jewellery rental" in the outlet menu, with its own dashboard like Parlour and Stitching (tiles with live counts, lists, its own bills). Rental bills are numbered `ABC-R-000123`.
2. **Rent now**: a walk-in customer takes jewellery today without a pre-booking. Same screen as Book with "today" as the start date; saving goes straight to the hand-over step.
3. **Add or remove pieces** from a pre-booking when the customer comes to take it (already in v2 Stage 2).
4. **Return bill** = price per day × days rented × quantity, plus **damage** and **missing** charges added by the in-charge, minus a discount (already in v2 Stage 3).
5. **Check at login, every day**: when an outlet user logs in, the app first cancels that outlet's
   - **parlour** appointments of earlier days that were not done, and
   - **rental pre-bookings** whose take-away date has passed and that were **not collected** (status still Booked),
   each with the reason "Not collected by the booked date" / "Not done by end of day", logged by "System". The same check also runs when the Parlour or Jewellery rental screen is opened. **No scheduler** (owner decision).
6. **Cancel & reschedule** for rental pre-bookings (same as parlour): cancel this booking and book the same pieces for new dates, availability checked again.

### Module dashboard
```
[ 💎 Rent now ] [ 📅 Book ] [ 🤝 Hand over · 3 ] [ ↩ Due back · 2 ] [ ⚠ Late · 1 ] [ 🔧 Under repair · 1 ] [ ▣ Scan slip ]
Tabs: Bookings by day · Find booking · With customer · Bills
```
- **Hand over · N**: pre-bookings to collect today (tap → hand-over screen).
- **Due back · N** and **Late · N**: rentals with the customer, due today / past their return date (tap → return screen).
- **Under repair · N**: pieces sent for repair (tap → list with "Repaired, back in stock").
- **Scan slip** opens a booking from its slip or challan barcode.
- **Bookings by day**: date arrows, cards for everything taking place that day (take-aways and returns).
- **Find booking**: booking number / challan number / mobile / name, with filters Booked · With customer · Returned · Cancelled · Not collected.
- **Bills**: rental bills only (challans are not bills).

## Business flow (step by step, for the outlet in-charge)

### The three papers the customer gets
| When | Paper | Has an amount? | Purpose |
|---|---|---|---|
| Pre-booking | **Booking slip** (`ABC-BK-000123` + barcode) | Estimate only | Proof of booking; brought on hand-over day |
| Hand-over | **Delivery challan** (`ABC-000245` + barcode) | Estimate only, "final amount on return" | List of every piece given, return date; customer signs the shop copy |
| Return | **Bill** (`ABC-000251`) | **Yes, final** | Rent + damage + missing − discount |

The challan is the checklist for the return: every piece on it must be accounted for before the bill can be made.

```
 PRE-BOOK                  HAND-OVER DAY                       RETURN DAY
 ────────                  ─────────────                       ──────────
 Customer asks       ──►   Customer comes              ──►     Customer brings pieces back
 Pick pieces + dates       Find booking                        Find booking (challan / mobile)
 System checks free        Tick pieces given                   Mark each piece OK / Damaged / Missing
 Save → booking slip       + Add more jewellery                Damaged → back to stock or repair
 Pieces blocked            Change return date                  Add charges, discount
 for those days            See estimated cost                  Generate bill → print
                           Hand over → print CHALLAN           Stock updated
                           Stock goes out
```

### Stage 1: Pre-book (any day before)
1. Customer calls or visits and asks for jewellery for certain dates.
2. In-charge opens **Jewellery rental → Book**.
3. Types the customer's **mobile number**. A returning customer's name fills in by itself; a new customer's name is typed once.
4. Searches or **scans** each piece and sets the quantity. Each piece shows **Available** (green) or **Not available** with the reason, e.g. "Booked by Meena, 14/10/2026 to 16/10/2026".
5. Picks the **hand-over date** and **return date**. The **estimated cost** shows at the bottom.
6. Taps **Save booking**. The system:
   - gives the booking a number, e.g. `ABC-BK-000123`
   - **blocks those pieces for those days**: nobody else can book them for overlapping dates
   - shows the **Booking slip** → **Print slip** (or tell the customer the number).
7. Nothing is charged and no stock moves yet.

If plans change before hand-over: **Change date** (the system re-checks the pieces are free) or **Cancel booking** (the pieces are freed).

### Stage 2: Hand-over day: find the booking, hand over, print the challan
1. Customer arrives. In-charge opens **Jewellery rental → Hand over**.
2. **Finding the booking** (any one works):
   - the booking appears in the **"To hand over today"** list, so just tap it, or
   - **scan** the barcode on the booking slip, or
   - type the **mobile number**, name, or booking number in the search box.
   - Bookings whose date has passed but were not collected show at the top in orange.
3. The **hand-over screen** shows the booked pieces. As each piece is given, tick **Given ✓**. If the customer no longer wants one, tap **Not taking this one**.
4. Customer wants more? **➕ Add more jewellery** → search or scan → the system checks it is free for the rental days before adding it.
5. Customer wants it longer or shorter? Change the **return date**. Every piece is checked again; if a piece is booked by someone else after the old date, the system says so.
6. The **estimated cost** box updates live, e.g. "7 pieces · 3 days · ₹6,900".
7. Tap **Hand over & print challan**. The system:
   - creates the **delivery challan** (pieces, codes, quantities, return date, estimated cost). It is **not** a bill and is not counted as a sale
   - takes the pieces **out of stock**
   - moves the booking to **"With customer"**.
8. Print two copies: customer keeps one; the customer signs the shop copy.

### Stage 3: Return day: find the challan, check the pieces, make the bill
1. Customer brings the jewellery back. In-charge opens **Jewellery rental → Return**.
2. **Finding the challan** (any one works):
   - tap it in **"Due back today"** or **"Late"** (shows "2 days late"), or
   - **scan** the barcode on the customer's challan copy, or
   - type the **mobile number**, name, challan number or booking number.
3. The **return screen** shows exactly what is on the challan: "Given 7 pieces on 14/10/2026 · 0 checked so far".
4. In-charge checks every piece against the challan and taps one of:
   - **✅ Returned OK** → goes back to stock.
   - **⚠ Damaged** → type the damage charge, pick a note ("Broken clasp", "Stone missing", …), then decide **Back to stock** or **🔧 Send for repair**.
   - **❌ Missing** → the charge fills in from the piece's "Value if lost" (can be changed). The piece is removed from stock for good.
   - For several of the same piece (e.g. 5 chains), use the counters: OK 3 · Damaged 1 · Missing 1.
5. The **bill preview** builds itself: rent (actual days, counted from hand-over to today), damage lines, missing lines, discount, total.
6. **Generate bill** only unlocks when **every piece on the challan is checked**. Then a final check in plain words: "Given 7 · Returned 6 (1 damaged) · Missing 1. Is this correct?" → **Yes, generate bill**.
7. The system:
   - creates the final **bill** and prints it
   - puts OK and "back to stock" pieces back in stock; repair pieces go to the **Under repair** list; missing pieces are written off
   - closes the booking (**Completed**).

### Stage 4: After repair
**Jewellery rental → Under repair** → when a piece comes back from the repairer, tap **Repaired, back in stock**. It can be booked again.

### Worked example
| Date | What happens | Numbers |
|---|---|---|
| 05/10/2026 | Priya books a bridal necklace (₹1,000/day) and 5 gold chains (₹200/day each) for 14/10/2026 to 16/10/2026 | 2 days × ₹2,000 = **₹4,000 estimate**. Slip `ABC-BK-000123` |
| 10/10/2026 | Meena tries to book the same necklace for 15/10/2026 | "Not available on 15/10/2026 (booked by Priya, 14/10/2026 to 16/10/2026)" |
| 14/10/2026 | Priya comes. In-charge scans the slip, ticks the necklace and 5 chains, **adds** jhumkas (₹300/day), changes return to **17/10/2026** | 3 days × ₹2,300 = **₹6,900 estimate**. Challan `ABC-000245` printed and signed |
| 17/10/2026 | Priya returns. In-charge scans the challan. Necklace OK, jhumkas OK, chains: **3 OK, 1 damaged** (broken clasp, ₹300, sent for repair), **1 missing** (value if lost ₹8,000) | Rent ₹6,900 + damage ₹300 + missing ₹8,000 = **₹15,200**. Bill `ABC-000251` |
| | Stock after return | Chains: 3 back in stock, 1 under repair, 1 removed. Necklace and jhumkas back in stock |

If Priya had returned on 18/10/2026 instead, rent would be 4 days (₹9,200) automatically.

## What already exists (reused, not rebuilt)
| Already works | Where |
|---|---|
| Pre-booking a rental with hand-over and return dates | `BookingService.create`, `NewBookingModal` |
| Pieces are blocked for other customers on overlapping days (stock-aware, row lock against double-booking) | `BookingService.availability` |
| Live "Available / Unavailable" badge while booking | `NewBookingModal` |
| Hand-over issues a zero-amount delivery challan, stock goes out | `BookingService.handOver` |
| Return bills price per day × qty × days (return date − hand-over date, min 1); late returns are charged for the extra days automatically | `BookingService.returnRental` |
| Bookings list with search by customer name / mobile, "By day" and "With customer" tabs | `BookingsPage` |

## What is missing (this feature)
| Gap | Change |
|---|---|
| A booking has no number the customer can quote | Each booking gets a **booking number** (e.g. `ABC-BK-000123`), printed on a **booking slip** with a barcode |
| Search finds only by name/mobile | Search also by **booking number**, **challan number**, or **scanning the slip/challan barcode** |
| Hand-over cannot add pieces or change the return date | Hand-over screen: **add more jewellery**, **change return date**, live **estimated cost**, availability checked for every piece |
| Hand-over shows no checklist | Tick each pre-booked piece as it is handed over (catches a forgotten piece) |
| Return assumes everything came back fine | Return screen: each piece marked **Returned OK / Damaged / Missing**; bill cannot be generated until every piece is marked |
| No damage or missing charges | Per-piece **damage charge** (+ short note) and **missing charge**; shown as separate lines on the bill |
| Missing pieces go back into stock | Missing pieces are **not** put back into stock |
| The challan is stored as a ₹0 bill, so it inflates the "bills today" count, and the screen guesses "is this a challan?" from the item name text (BUG-07) | Bills get an explicit **type** (`BILL` / `CHALLAN`); challans are excluded from bill counts and sales |

## Screens (mobile/tablet first, big buttons, plain words)

A menu item **"Jewellery rental"** (icon: diamond) with the module dashboard described in "What's new in v3" (tiles: Rent now, Book, Hand over, Due back, Late, Under repair, Scan slip).

### 1. Book (existing form, small additions)
- Same as today's "New booking" form for rentals.
- After saving: a **Booking slip** window: booking number + barcode, customer, pieces, hand-over and return dates, estimated cost. Buttons **Print slip** and **Done**.

### 2. Hand over
- **Find the booking**: one big search box: "Booking number, mobile or name" + **Scan** button. Below it, **"To hand over today"** as large cards (customer, mobile, pieces, dates). Late hand-overs (start date passed) appear at the top with an orange "Was due on …" badge.
- Tap a card → **Hand-over screen**:
  1. **Pieces booked**: each piece with a big checkbox "Given ✓". All must be ticked (or removed with "Not taking this one").
  2. **➕ Add more jewellery**: same search/scan picker as billing. Each added piece shows "Available" or the reason it is not (e.g. "Booked by Priya, 14/10/2026 to 16/10/2026").
  3. **Return date**: date picker, pre-filled from the booking. Changing it re-checks every piece.
  4. **Estimated cost** box, updates live: "5 pieces · 3 days · ₹4,500".
  5. Big button **Hand over & print challan**. The challan shows pieces, return date and estimated cost (marked "Estimate, final amount on return").
- Hand-over date is today by default; "Handed over earlier?" link reveals a date picker (keeps today's early hand-over behaviour).

### 3. Return & bill
- **Find the booking**: same search box (also accepts the challan number / barcode). Below it, **"Due back today"** and **"Late"** (red, "2 days late") lists.
- Tap a card → **Return screen**:
  1. A summary line: "Given 5 pieces on 12/10/2026 · 3 marked so far".
  2. One card per piece given (name, code, photo-less), with three big buttons:
     `[ ✅ Returned OK ]  [ ⚠ Damaged ]  [ ❌ Missing ]`
     - **Damaged** → amount field (₹) + optional note with quick chips ("Stone missing", "Broken clasp", "Bent", "Polish needed"), then the in-charge picks **where it goes**: `[ Back to stock ]` or `[ 🔧 Send for repair ]`.
     - **Missing** → amount field (₹), pre-filled with the piece's **Value if lost** × missing quantity (editable). Missing pieces are **removed from stock for good**.
     - Pieces with quantity > 1 show counters. Example: 5 gold chains (same code) given:
       `Returned OK 3 · Damaged 1 · Missing 1`, and for the damaged one: `Back to stock 0 · Send for repair 1`.
       Result: 3 back to stock, 1 under repair, 1 removed from stock.
  3. **Bill preview**:
     ```
     Rent: 5 pieces · 3 days        ₹4,500
     Damage: Necklace (clasp)         ₹300
     Missing: 1 bangle              ₹1,200
     Discount                      − ₹0
     Total                          ₹6,000
     ```
  4. **Generate bill** is disabled until every piece is marked. Before saving, a confirm window repeats the check in plain words: "Given 5 · Returned 4 (1 damaged) · Missing 1. Is this correct?" → **Yes, generate bill** / **Go back**.
  5. Bill prints with the existing receipt layout; damage and missing appear as their own lines.

### 4. Under repair
- A fourth, smaller tile **"🔧 Under repair · 2"** on the Jewellery rental screen.
- List of pieces sent for repair: piece, quantity, damage note, from which booking/customer, sent on date.
- One big button per row: **Repaired, back in stock**. Stock goes up by that quantity and the piece can be booked again.
- A piece under repair cannot be booked (it is not counted as stock).

### Billing page
- ~~The blue "Pre-booked for …" card opens the hand-over screen.~~ **Replaced by `outlet-modules.md`** (if approved): all of this flow lives in the **Jewellery rental** module, and the general billing page (renamed Shop sales) no longer handles bookings.

### States (every screen)
- All dates are shown and typed as **dd/mm/yyyy** (times as 12-hour, e.g. 04:35 pm).
- Loading: "Loading bookings…". Empty: "Nothing to hand over today." / "No returns due today." Error: friendly message + **Try again**.
- Not found on search/scan: "We couldn't find a booking with that number."

## API (v3: module endpoints)
All under **`/api/outlet/me/rental`** (v2 planned `/bookings`; the module split moves them), outlet taken from the JWT (never from the request), `hasRole('OUTLET')`. Only items whose service is in the **Jewellery rental** module can be rented here. The old `/bookings` rental actions stay for the old Bookings page until the modules step removes it.

| v3 path | Purpose |
|---|---|
| `GET /products?search=` | Rental pieces of this outlet with price per day, stock, value if lost |
| `GET /availability?itemId&from&to&quantity` | Live "Available / booked by …" check |
| `POST /bookings` | Book (start date today or later) |
| `POST /bookings/rent-now` | Book for today **and** hand over in one step (returns the booking with its challan) |
| `GET /bookings/day?date=` · `GET /bookings?status&search&page` · `GET /bookings/lookup?code=` · `GET /bookings/{id}` | Lists, search, scan, details |
| `GET /dashboard` | Counts for the tiles (hand over today, due back, late, under repair) |
| `POST /bookings/{id}/hand-over` | As below (add/remove pieces, return date, challan) |
| `POST /bookings/{id}/return` | As below (per-piece check, charges, bill `-R-`) |
| `POST /bookings/{id}/cancel` · `POST /bookings/{id}/cancel-and-reschedule` | Cancel / cancel & reschedule (pre-bookings only) |
| `GET /bookings/{id}/log` · `POST /bookings/{id}/comments` | Timeline |
| `GET /repairs` · `POST /repairs/{id}/back-in-stock` | Under repair |
| `GET /bills` | Rental bills only |

The login check runs inside the existing login endpoint after a successful outlet login (one quick update per module, safe to repeat).

The v2 table below describes the hand-over and return bodies, which are unchanged:

| Method & path | Purpose |
|---|---|
| `GET /?view=…&search=…` | **Changed:** `search` also matches booking number and challan number |
| `GET /lookup?code=ABC-BK-000123` | **New:** exact lookup by booking number or challan number (used by scan). 404 if not this outlet's |
| `GET /handovers-due` | **New:** booked rentals with start date ≤ today, oldest first |
| `GET /returns-due` | **New:** handed-over rentals due today or late, oldest first |
| `POST /{id}/hand-over` | **Changed body:** `{ date?, expectedReturnDate, removeItemIds: [], addItems: [{itemId, quantity}] }` → re-checks availability for every piece for `[date, expectedReturnDate]`, updates the booking, issues the challan |
| `POST /{id}/return` | **Changed body:** `{ date?, discount, items: [{ itemId, okQty, damagedQty, repairQty, missingQty, damageCharge, damageNote, missingCharge }] }` → rejects if any given piece is not fully accounted for (`ok + damaged + missing ≠ given`, or `repairQty > damagedQty`). Stock: `+ ok + (damaged − repair)`; repair qty opens a repair record; missing qty never returns to stock |
| `GET /repairs` | **New:** pieces currently under repair at this outlet |
| `POST /repairs/{repairId}/back-in-stock` | **New:** marks a repair done; stock goes up by its quantity |

`BookingResponse` gains: `bookingNumber`, and per item `addedAtHandOver`, `okQty`, `damagedQty`, `missingQty`, `damageCharge`, `missingCharge`, `damageNote`, `replacementValue`. `BillResponse` gains `type` (`BILL` / `CHALLAN`) and per line `lineType` (`ITEM`, `RENTAL`, `DAMAGE`, `MISSING`, `CHALLAN`, `CUSTOM`).

Validation (server side, one error format as today):
- Charges are `BigDecimal`, ≥ 0, max 2 decimals. A damage/missing quantity > 0 needs a charge field present (0 allowed, so staff can waive it on purpose).
- Hand-over must keep at least one piece.
- Return date not before hand-over, not in the future (as today).

## Data (one new migration `V16__rental_flow.sql`, no edits to old ones)
- `booking.booking_number VARCHAR(30) UNIQUE` (back-filled for existing rows, same `PREFIX-BK-000123` pattern as bill numbers).
- `booking_item`: `added_at_handover BOOLEAN DEFAULT false`, `ok_qty INT`, `damaged_qty INT`, `missing_qty INT`, `damage_charge NUMERIC(10,2)`, `missing_charge NUMERIC(10,2)`, `damage_note VARCHAR(200)`, with CHECKs (≥ 0, and `ok + damaged + missing = quantity` when set).
- `bill.bill_type VARCHAR(10) NOT NULL DEFAULT 'BILL'` CHECK in (`BILL`, `CHALLAN`); existing challans back-filled using the current challan label.
- `bill_item.line_type VARCHAR(10) NOT NULL DEFAULT 'ITEM'`; back-filled for existing rental/challan/stitching lines.
- `service_item.replacement_value NUMERIC(10,2) NULL` (optional "Value if lost" per piece on a jewellery product, used to pre-fill the missing charge).
- New table `item_repair` (outlet_id, service_item_id, booking_id, quantity, note, status `UNDER_REPAIR` / `BACK_IN_STOCK`, sent_on, back_on): the in-charge's "Send for repair" decisions.
- Index `booking(outlet_id, status)` (from DB-4) for the due lists.

**v3 data (V20):** the timeline table `booking_log` (V19) gets three more kinds: `HANDED_OVER`, `RETURNED`, `REPAIR`. Everything else (booking number, per-piece return fields, repairs, value if lost, cancel reason / auto-cancel / reschedule link, bill type and module) already exists from V16, V17 and V19. Products get the "Value if lost" field on the Products page.

## Edge cases
- **Tenancy:** every new/changed endpoint gets a test that outlet A cannot look up, list, hand over or return outlet B's booking (404), and a booking number from B returns "not found" for A.
- **Added piece not free:** hand-over is blocked with the reason; staff can pick another piece or a shorter return date.
- **Return date extended at hand-over** clashes with the next customer's booking → blocked with "Booked by X from …", same as booking.
- **Two staff hand over the same booking at once:** booking row locked; the second gets "Already handed over".
- **Early return:** charged actual days, minimum 1 (current rule, unchanged).
- **Late return:** extra days charged automatically (current rule). Late lists show "N days late".
- **Missing piece found later:** billed as missing and the booking is closed (owner decision). If it turns up, staff add it back as stock on the Products page.
- **Missing / sent-for-repair piece already pre-booked by someone else:** fewer pieces now exist, so a future booking may no longer be covered. The return screen warns: "This piece is booked by Priya on 20/10/2026. Only 2 left for 3 booked." The return still saves; the future booking shows a red "Not enough stock" badge so staff can call the customer or change the piece.
- **All pieces missing:** allowed; rent + missing charges are billed.
- **Discount** applies to the whole bill and cannot exceed the subtotal (current rule).
- **Old bookings** made before this change: get a back-filled number; return screen works the same (all lines start unmarked).
- **Offline:** hand-over and return need the internet because availability and stock must be checked live. The screen shows "You're offline. Hand-over and return need internet." instead of failing silently. (Offline billing for normal sales is a separate feature.)
- **Roles:** the code today has `FRANCHISOR` and `OUTLET` (one login per outlet). These screens are for `OUTLET`; when `FRONT_DESK`/`STAFF` logins arrive they plug into the same central role check.

## Out of scope (v1)
Security deposit / advance payment (later), customer self-booking, SMS/WhatsApp reminders, photos of pieces.

## Decisions (confirmed by owner, 2026-10-11)
1. **Staff only** create pre-bookings (phone / walk-in). No customer self-booking.
2. **Missing piece:** billed as missing, booking closed, quantity removed from stock.
3. **"Value if lost"** field added to products; pre-fills the missing charge.
4. **Damaged piece:** the outlet in-charge decides per piece at return: **back to stock** or **send for repair** (out of stock until marked repaired). Works per quantity, e.g. 5 chains given → 3 OK, 1 damaged (to repair), 1 missing.
5. **Deposit / advance:** later, separate feature.

## Decisions for v3 (owner, 2026-10-11)
1. **Days** = return date − take-away date, minimum 1 (take on 14th, return on 16th = **2 days**).
2. **Late return**: only the extra days at the same price per day; no fine.
3. **Not collected by the booked date**: the booking is **cancelled** (no grace day). A late customer is booked again with Rent now if the pieces are free.
4. **No scheduler.** The check runs **per outlet when that outlet logs in**. The same check also runs when the Parlour or Jewellery rental screen is opened (covers a login session that stays open past midnight). The 6:00 AM parlour job built earlier is switched off.
5. **Price** is the one entered on the product screen (price per day for rental pieces).
