# Feature: Stitching orders: per-garment dates, partial delivery, advances, refunds and order log

Status: v4, approved by owner (see §12). Steps 2–4 done (migration, API + tests, screens), waiting for review. Not in this round: the "Bills" tile (needs the module-filtered bill list from outlet-modules.md).
Part of the **Stitching** module (see `outlet-modules.md`).

## 1. Purpose
1. A customer gives one stitching order with **one or more garments**. Each garment has its **own estimated delivery date**, measurements and (optional) price. The outlet can take **advances** and prints a **receipt**.
2. Each garment moves through **Not started → Started → Finished** (a dropdown; moving back is allowed for mistakes).
3. On a delivery day the outlet finds the order (Due today / scan receipt / receipt number / mobile), sees each garment's status, and **delivers the finished garments the customer is taking now**. A bill is made **for those garments only**; advances are taken off.
4. If the order is cancelled, or the advance is more than what is finally billed, the outlet decides how much to give back and prints a **refund challan**.
5. Every order has an **append-only log** of all steps and **staff comments** (author + time), never shown on bills.

## 2. What already exists (reused)
| Works today | Where |
|---|---|
| Order with garments (free-text name), measurements, notes, one estimated delivery date | `StitchService.create`, `OrderFormModal` |
| Order number `STC-000012`, printed measurement slip | `StitchService`, `DetailsModal` |
| Search by order number, customer name or mobile | `StitchOrderRepository.search` |
| Order statuses In progress → Ready → Delivered, Cancel | `StitchStatus` |
| Amount per garment entered when ready; one bill on delivery with discount | `markReady`, `deliver` |
| Due today / overdue / upcoming lists (dashboard) | `day`, `overdue`, `upcoming` |

## 3. What changes
| Today | New |
|---|---|
| One delivery date per order | **Delivery date per garment** (calendar) |
| Status on the order | **Status per garment**: Not started / Started / Finished / Delivered / Cancelled, changed from a **dropdown**; moving back allowed |
| Whole order delivered at once, one bill | **Partial delivery**: pick the finished garments being taken now → a bill for those; repeat later for the rest |
| Price only when ready | Price per garment **optional at order time**, can be entered or changed any time **before that garment is billed** |
| No advance | **Several advances** per order, used up bill by bill |
| No refunds | **Refund challan**: outlet decides the amount to return (cancel, or advance left over) |
| Measurements always typed | Per garment: **Use previous measurements** or **Enter fresh** |
| Slip shows only measurements | Well-designed **Customer receipt** + **Work slip** |
| No history | **Order log** with every step and staff **comments** |
| Search by typing only | Also **scan the receipt barcode** |

## 4. Business flow

### Stage 1: Take the order
1. **Stitching → New order** (or from the Customer visit screen, customer already filled in).
2. Customer mobile (name fills in for a returning customer).
3. For each garment (**Add another garment** for more):
   - **Garment**: typed by the outlet (e.g. "Blouse with boat neck").
   - **Measurements**: `Use previous measurements` (pick from the customer's earlier ones, newest first, e.g. "Blouse · 02/09/2026 · STC-000031"; copied in and still editable) or `Enter fresh measurements`. Only "fresh" is shown for a customer with no history.
   - **Delivery date**: from the **calendar**. The first garment's date is pre-filled into the next garment to save taps; change it when a garment is needed earlier or later.
   - **Price** (₹, optional now; "Add later" is fine) and **note** (optional).
4. **Fabric** (dropdown): `Customer's own fabric` / `In-house purchase` / `In-house purchase · <today's shop bill>` (links that bill, see `outlet-modules.md` §12). An in-house purchase does not need a bill (e.g. bought on an earlier visit).
5. **Advance received** (₹, optional). Live summary: `Total ₹4,800 (1 price to add) · Advance ₹1,000`.
6. **Save & print** → every garment **Not started** → log: "Order created".

### Stage 2: While garments are being made
- The list shows each order with a **progress line**: `5 garments · 1 delivered · 2 finished · 2 started` and the **next delivery date**.
- In the order, each garment row has a **Status dropdown** (`Not started`, `Started`, `Finished`). Changing it saves at once and logs "Blouse: Started → Finished". Moving back (e.g. Finished → Started) is allowed for mistakes. *Set all to…* changes every open garment at once.
- **Add advance** any time before the last delivery → advance receipt prints → log.
- **Edit** price, measurements, note or delivery date of any garment not yet delivered → log says what changed ("Price of Salwar: added ₹1,000", "Delivery date of Lehenga: 25/10/2026 → 02/11/2026").
- **Add comment** at any time, also after delivery.

### Stage 3: Delivery day (full or partial)
1. **Stitching → Due today**: lists **garments** due today (late ones in red), grouped by order. Or **scan the receipt**, or type the **receipt number / mobile**.
2. The order opens with every garment and its status shown clearly:
   - **Finished** garments have a **tick box**, ticked by default when due today or earlier.
   - **Not started / Started** garments show "Not finished yet" and a **Change delivery date** button (calendar).
3. In-charge ticks the garments the customer is taking now → **Deliver selected & bill**.
4. **Bill preview** (only the selected garments):
   ```
   Blouse with boat neck              ₹800
   Salwar                           ₹1,000
   Subtotal                         ₹1,800
   Discount                          − ₹0
   Bill total                       ₹1,800
   Advance used                    − ₹1,000
   ─────────────────────────────────────────
   Balance to pay now                 ₹800
   Still to deliver: 3 garments · advance left ₹0
   ```
   - A selected garment without a price must be priced here before the bill can be made.
   - **Advances are used up in order**: each delivery bill uses as much of the remaining advance as it needs; anything left carries to the next delivery and is shown as "advance left".
5. **Generate bill** → `ABC-ST-000253` (lists the garments, advance used, balance) → those garments become **Delivered** → log line. The rest of the order stays open.
6. The order is **Delivered** when every garment is delivered (or cancelled).
7. If, when the order closes, **advance is left over** (prices lowered, discount), the screen says "₹200 advance left, return to customer?" and opens the **refund** step (Stage 4).

### Stage 4: Cancel and refund
- **Cancel garment** (one garment) or **Cancel order** (all garments not yet delivered); reason required (Customer cancelled / Fabric problem / Other + comment).
- If paid advance is more than what has been billed, the **Refund** step opens:
  ```
  Advance paid                     ₹1,000
  Already used on bills                ₹0
  Available to return              ₹1,000
  Amount to return   [ ₹ 700 ]   (outlet decides, 0 to 1,000)
  Kept by shop (cancellation charge)  ₹300
  ```
- **Save & print refund challan** → a separate paper `ABC-RF-000012` (customer copy + shop copy, customer signs the shop copy): order no., garments cancelled, advance paid, amount returned, amount kept, reason. Money is handed over manually; the app only records it.
- Log: "Refund ₹700 · kept ₹300 · RF-000012".

## 5. Order log and comments
Timeline on the order details screen:
```
11/10/2026, 10:42 am  Outlet Anna Nagar  Order created · 5 garments · advance ₹1,000
11/10/2026, 10:43 am  Outlet Anna Nagar  💬 "Extra lining in blouse, no charge" — Kavya
13/10/2026, 04:10 pm  Outlet Anna Nagar  Blouse: Not started → Started
18/10/2026, 11:05 am  Outlet Anna Nagar  Price of Salwar: added ₹1,000
20/10/2026, 12:15 pm  Outlet Anna Nagar  Delivered Blouse, Salwar · bill ABC-ST-000253 · advance used ₹1,000
02/11/2026, 05:00 pm  Outlet Anna Nagar  Lehenga cancelled: Customer cancelled
02/11/2026, 05:02 pm  Outlet Anna Nagar  Refund ₹700 · kept ₹300 · RF-000012
```
- Automatic entries for every step: created, status change, edit, advance, delivery date change, delivery (bill no.), cancel (reason), refund.
- **Comments** any time (also after delivery), shown with 💬.
- **Who**: the signed-in user's name (today one login per outlet; per-person names come automatically with staff logins). Until then an optional **"Your name"** field on the comment box (remembered on that device).
- **Append-only**: never edited or deleted. A wrong comment is corrected with a new one.
- **Never printed** on bills, receipts or refund challans. **Shown on the work slip** for the tailor (decision 18).

## 6. Printed papers (good-looking, print-ready)
Shop name and address from settings, clean layout, clear sections; 72 mm thermal style and A5/A4. A **preview** opens first with Print buttons.

**Customer receipt** (at order time; reprintable with current status):
```
          SANA'S BOUTIQUE
     12, Main Road, Anna Nagar
──────────────────────────────────
 STITCHING RECEIPT
 STC-000045          11/10/2026
 ║║│║║│║│║║│║   (barcode)
──────────────────────────────────
 Priya · 98765 43210
 1. Blouse with boat neck  ₹800   Delivery 20/10/2026
 2. Salwar         (price later)  Delivery 20/10/2026
 3. Lehenga              ₹3,000   Delivery 02/11/2026
──────────────────────────────────
 Total so far             ₹3,800
 Advance paid             ₹1,000
──────────────────────────────────
 Please bring this receipt.
```
**Work slip** (shop / tailor): order no. + barcode, each garment with delivery date (big), measurements, note, fabric, staff comments. No prices.
**Advance receipt**, **Delivery bill**, **Refund challan**: same visual style.

## 7. Screens (Stitching module)
```
[ ✂️ New order ] [ 📅 Due today · 3 ] [ ⚠ Late · 1 ] [ 🔍 Find order ] [ 🧾 Bills ]
Tabs: Open · Ready to deliver · Delivered · Cancelled
```
- **Order cards** (mobile-first): order no., customer, progress line ("5 garments · 2 finished…"), next delivery date (Today / Late badges), advance, **Deliver** when any garment is finished.
- **Order details**: garment rows (status dropdown, delivery date, price, measurements), advances, bills made so far, refund challans, timeline with comments; buttons: Deliver selected & bill, Add advance, Edit, Print, Cancel, Add comment.
- States: loading, empty ("No garments due today."), friendly errors with **Try again**. Dates dd/mm/yyyy.

## 8. Data (in V17 together with modules; V16 untouched)
- `stitch_item`: `status` (`NOT_STARTED`, `STARTED`, `FINISHED`, `DELIVERED`, `CANCELLED`), `estimated_delivery_date DATE NOT NULL`, `measured_on DATE`, `started_at`, `finished_at`, `delivered_at`, `cancelled_at`, `cancel_reason`, `bill_id → bill` (the delivery bill that billed it). Back-fill: date from the order; status from the order (In progress → Started, Ready → Finished, Delivered → Delivered with the order's bill, Cancelled → Cancelled).
- `stitch_order.status` becomes a **summary kept by the service**: `OPEN`, `DELIVERED`, `CANCELLED` (for fast lists). `stitch_order.estimated_delivery_date` and `stitch_order.bill_id` are kept for old data only (made nullable, no longer written).
- `stitch_order.fabric_bill_id → bill` (from `outlet-modules.md`).
- `stitch_order.fabric_source` (`OWN` / `IN_HOUSE`), V18: in-house purchase with or without a linked bill (owner request, 2026-10-11).
- New table `stitch_payment` (id, outlet_id, order_id, kind `ADVANCE` / `REFUND`, amount > 0, kept_amount ≥ 0 (refunds only), number (refunds: `PREFIX-RF-000012`), reason, created_by, created_at).
- `bill.advance_paid NUMERIC(10,2) NOT NULL DEFAULT 0`: advance used on that bill. Advance left = sum(advances) − sum(advance_paid on the order's bills) − sum(refunds) − sum(kept).
- New table `stitch_order_log` (id, outlet_id, order_id, item_id NULL, kind, message, from_value, to_value, user_id → app_user, author_name, created_at). Append-only.

## 9. API (`/api/outlet/me/stitching`, outlet and user from the JWT)
| Method & path | Purpose |
|---|---|
| `POST /` | **Changed:** garments carry `deliveryDate`, optional `amount`, `measurements`, `copiedFromItemId`; optional `advance`, `fabricBillId` |
| `PUT /{id}/items/{itemId}` | **New:** edit one garment (price, measurements, note, delivery date) until delivered |
| `POST /{id}/items` | **New:** add a garment to an open order |
| `POST /{id}/items/{itemId}/status` `{ status }` | **New:** Not started / Started / Finished (replaces `/ready`) |
| `GET /?view=…&search=…` | **Changed:** Open / Ready to deliver / Delivered / Cancelled; search matches receipt number exactly too |
| `GET /due?date=` · `GET /overdue` | **Changed:** garment-level due lists |
| `GET /lookup?code=STC-000045` | **New:** scan |
| `POST /{id}/advances` `{ amount }` | **New** |
| `POST /{id}/deliver` `{ itemIds, prices?, discount }` | **Changed:** bills only the selected finished garments; uses available advance |
| `POST /{id}/cancel` `{ itemIds? , reason, comment? }` | **Changed:** cancel some or all undelivered garments |
| `POST /{id}/refunds` `{ amount, reason }` | **New:** refund challan; amount ≤ advance available; rest recorded as kept |
| `GET /{id}/log` · `POST /{id}/comments` | **New:** timeline; add comment |
| `GET /customers/{customerId}/measurements` | **New:** previous measurements |

Validation: money `BigDecimal` ≥ 0, 2 decimals; delivering requires Finished + price for every selected garment; refund ≤ advance available; one refund per order closing (no second refund once the advance is settled); comments 1–1000 chars; closed orders accept comments only.

## 10. Reports
- **Sales** = delivery bills (full bill total), counted when the bill is made. Advances and refunds are not sales.
- **Cancellation charges** (amounts kept on refund) appear as their own line in reports, not mixed into stitching sales. (Question 1.)
- No cash/payment recording beyond this (owner decision: payments are manual).

## 11. Edge cases
- **Tenancy:** every new/changed endpoint gets a test that outlet A cannot see, scan, edit, change status, add advance, comment, deliver, cancel, refund or read the log/measurements of outlet B's orders and customers.
- Customer lost the receipt → search by mobile; reprint.
- Garment delivered early (before its date) → allowed if Finished.
- Discount on a partial bill applies to that bill only.
- Advance taken before any price is known → allowed; the receipt shows "Total so far".
- Two staff deliver the same garments at once → order row locked; second gets "Already delivered".
- Previous measurements belong to the customer at **this outlet** only.

## 12. Decisions (owner, 2026-10-11)
1. Garment name and price are **typed by the outlet**; no garment dropdown.
2. Delivery dates are **picked from the calendar**, **one per garment**.
3. **Price is optional at order time** and can be entered any time before that garment is billed.
4. Existing orders: In progress → Started, Ready → Finished.
5. Measurements: **Use previous** or **Enter fresh**, per garment.
6. Customer receipt + work slip, **designed to look good**.
7. Status changed with a **dropdown**; **moving back a step is allowed**.
8. **Several advances** per order.
9. Find the order from **Due today, scan, receipt number or mobile**; status shown clearly.
10. **Deliver & bill** for finished garments; bill shows total, advance, balance.
11. A garment not finished shows **"Not finished yet"** and **Change delivery date**.
12. **Partial delivery**: deliver some garments now, the rest later, each with its own bill.
13. **Cancel with advance**: outlet decides the amount to return; a **separate refund challan** is printed.
14. No payment-mode recording; money is handled manually.
15. **Order log + staff comments**, append-only, never on bills.

16. Amounts **kept** on a refund show in reports as a separate **"Cancellation charges"** line.
17. **Advances are used bill by bill**: the first delivery uses the advance first; any left carries to the next.
18. The tailor's **work slip shows staff comments**.
