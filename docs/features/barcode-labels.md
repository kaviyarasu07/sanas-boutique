# Feature: Product barcode labels, price check and scan-to-bill

Status: DRAFT v2, waiting for review (workflow step 1). No code written yet.

## Purpose
- After an outlet adds a product, the owner taps **Make barcode** and prints a label.
- In **billing** and on a **Price check** screen, a user scans the label and sees the product's **current** details (name, price, stock, service, description). In billing, the scanned item is added to the bill.

## What already exists (reused)
- Every product (`service_item`) already gets a unique `item_code` like `SB-000123` when saved. Search and the billing item picker already match on it.
- `GET /service-items/by-code/{itemCode}` already looks a product up by code.
So the barcode value is the existing `item_code`. No schema change, no migration.

## Key decisions
1. **The barcode holds only the code.** Details are looked up live on every scan, so a price change is shown immediately and printed labels never go stale.
2. **The label does not print the price.** It prints the barcode, product name and code (readable text). This means a price change never makes a printed label wrong.
3. **No HTTPS at first, so scanning works in layers** (see below). Camera live-scan is a later upgrade when HTTPS exists.

## Scanning without HTTPS
Browsers only allow the live camera (getUserMedia) on HTTPS or localhost. Plan:

| Method | Needs HTTPS? | Notes |
|---|---|---|
| USB / Bluetooth barcode scanner | No | Types the code and presses Enter; works in the existing search box. **Primary method for now.** |
| Type the code manually (`SB-000123`) | No | Always available as a fallback. |
| "Take a photo of the barcode" (phone camera app, then read the barcode from the photo) | No | Uses a file input with camera capture, then decodes the picture in the browser. One extra tap versus live scan, and the label must be sharp and fill the photo. |
| Live camera scan (point and it reads) | **Yes** | Built behind the same **Scan** button, switched on automatically when the page is served over HTTPS. |

Cloud Run gives HTTPS automatically, so live camera scan starts working as soon as the app is deployed there. Only local network testing over plain http will lack it.

Note: installing the PWA and offline mode (service worker) also need HTTPS. Over plain http the app works as a normal website only. This matters for the "offline billing" rule in CLAUDE.md, so plan to deploy with HTTPS before relying on offline.

The camera library is a small non-UI package (for example `@zxing/browser`); this does not break the Mantine-only UI rule. To confirm.

## Screens (mobile/tablet first, plain language)
1. **Products page**: each product gets a **Make barcode** button (barcode icon + label).
   - Opens a **Barcode label** window: barcode, product name, code. Copies picker (1, 2, 5, 10 or +/-). **Print** and **Close**.
   - Tick several products, then **Print barcodes** for a sheet.
2. **Billing page**: a **Scan** button next to item search.
   - Hardware scanner: just scan; the item is added to the bill with its current price.
   - Phone: **Scan** opens the live camera (HTTPS) or the photo option (no HTTPS).
   - Not found: "We couldn't find that product."
3. **Price check page** (new menu item, large icon + label "Check price"): a big **Scan** button and a code box.
   - Shows a large card with the current price, name, service, description, stock (in stock / out of stock, or count) and active status.
   - **Scan another** button resets it. Does not touch any bill. Usable by FRONT_DESK and FRANCHISE_OWNER.

## API
- Reuse `GET /service-items/by-code/{itemCode}` for lookups. It always reads the database, so the price is current. Responses must not be cached by the browser or service worker (`Cache-Control: no-store`).
- Offline: if the product list is cached, show the last known price with a clear note "Price may be out of date, no internet." and never silently treat it as current.
- Barcode image is drawn in the browser from `item_code`; nothing is stored.

## Data
- No schema change.

## Edge cases
- **Tenancy**: by-code must only return products of the caller's own outlet (franchise_id from the JWT, never from the request). A code from another outlet returns "not found". Needs a test. FRANCHISOR may look across outlets.
- Legacy product with no code: generate one when **Make barcode** is tapped.
- Inactive product: shown on Price check with an "Not available" badge; billing blocks it with a friendly message.
- Stock 0: same warning as today's search. Labour services (no stock tracked) show no stock line.
- Scanner adds characters oddly (lowercase, spaces): trim and match case-insensitively.
- Same item scanned twice in billing: quantity goes up by 1.
- Printing: browser print dialog with a print style sized to the chosen label (see open questions).

## Decisions (confirmed by owner)
1. **Code 128** barcode. Best with USB scanners (they read 1D barcodes fastest), and phone cameras read it fine at label size. QR would only help cameras, and USB scanners are slower or unable with it.
2. **Label printer.** Default label size **50 x 25 mm**, kept as a single setting so it can change to the real roll size. (Owner to confirm the actual size when the printer is bought.)
3. **Both USB scanner and phone camera** are supported.
4. OK to add a small camera-reading library (not a UI library).

## Still to confirm
- Exact label roll size and printer model (affects only the print style, not the design).
