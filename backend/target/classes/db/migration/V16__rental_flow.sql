-- Jewellery rental flow (docs/features/jewellery-rental-flow.md):
-- booking numbers, pieces added at hand-over, per-piece return check with damage / missing
-- charges, repairs, "value if lost" on products, and explicit bill / line types.

-- 1. Booking number printed on the booking slip and searched / scanned at hand-over and return.
-- Same pattern as bill numbers: first 3 letters of the outlet name + '-BK-' + zero-padded id.
-- Nullable only for the instant between insert and the follow-up update that sets it
-- (it is derived from the generated id), like service_item.item_code.
ALTER TABLE booking ADD COLUMN booking_number VARCHAR(30) UNIQUE;
UPDATE booking b
   SET booking_number = upper(left(regexp_replace(o.name, '[^A-Za-z0-9]', '', 'g') || 'OUT', 3))
                        || '-BK-'
                        || CASE WHEN length(b.id::text) >= 6 THEN b.id::text ELSE lpad(b.id::text, 6, '0') END
  FROM outlet o
 WHERE o.id = b.outlet_id;

-- 2. Per booked piece: how many were added at hand-over (quantity already includes them),
-- and what came back. ok + damaged + missing = quantity once the rental is returned
-- (all NULL before that). repair_qty is the part of damaged_qty the in-charge sent for repair.
ALTER TABLE booking_item
    ADD COLUMN added_qty      INT NOT NULL DEFAULT 0,
    ADD COLUMN ok_qty         INT,
    ADD COLUMN damaged_qty    INT,
    ADD COLUMN repair_qty     INT,
    ADD COLUMN missing_qty    INT,
    ADD COLUMN damage_charge  NUMERIC(10,2),
    ADD COLUMN missing_charge NUMERIC(10,2),
    ADD COLUMN damage_note    VARCHAR(200);
ALTER TABLE booking_item
    ADD CONSTRAINT chk_booking_item_added CHECK (added_qty >= 0 AND added_qty <= quantity),
    ADD CONSTRAINT chk_booking_item_return_counts CHECK (
        (ok_qty IS NULL AND damaged_qty IS NULL AND repair_qty IS NULL AND missing_qty IS NULL)
        OR (ok_qty >= 0 AND damaged_qty >= 0 AND missing_qty >= 0
            AND repair_qty >= 0 AND repair_qty <= damaged_qty
            AND ok_qty + damaged_qty + missing_qty = quantity)),
    ADD CONSTRAINT chk_booking_item_charges CHECK (
        (damage_charge IS NULL OR damage_charge >= 0) AND (missing_charge IS NULL OR missing_charge >= 0));

-- 3. Optional per-piece value of a product if it is lost; pre-fills the missing charge.
ALTER TABLE service_item ADD COLUMN replacement_value NUMERIC(10,2)
    CONSTRAINT chk_service_item_replacement_value CHECK (replacement_value IS NULL OR replacement_value >= 0);

-- 4. Damaged pieces the in-charge sent for repair. They are out of stock (and so cannot be
-- booked) until marked back in stock.
CREATE TABLE item_repair (
    id              BIGSERIAL PRIMARY KEY,
    outlet_id       BIGINT NOT NULL REFERENCES outlet(id),
    service_item_id BIGINT NOT NULL REFERENCES service_item(id),
    booking_id      BIGINT REFERENCES booking(id),
    quantity        INT NOT NULL CHECK (quantity > 0),
    note            VARCHAR(200),
    status          VARCHAR(15) NOT NULL CHECK (status IN ('UNDER_REPAIR', 'BACK_IN_STOCK')),
    sent_on         DATE NOT NULL,
    back_on         DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_item_repair_back_on CHECK ((status = 'BACK_IN_STOCK') = (back_on IS NOT NULL))
);
CREATE INDEX idx_item_repair_outlet_status ON item_repair (outlet_id, status);
CREATE INDEX idx_item_repair_service_item ON item_repair (service_item_id);

-- 5. Explicit bill type: a delivery challan (no amount) is not a sale and must not count as one.
-- Until now the UI guessed it from the line text (BUG-07).
ALTER TABLE bill ADD COLUMN bill_type VARCHAR(10) NOT NULL DEFAULT 'BILL'
    CONSTRAINT chk_bill_type CHECK (bill_type IN ('BILL', 'CHALLAN'));

-- 6. Explicit line type, so bills can show rent, damage and missing charges as separate lines.
ALTER TABLE bill_item ADD COLUMN line_type VARCHAR(10) NOT NULL DEFAULT 'ITEM'
    CONSTRAINT chk_bill_item_line_type CHECK (line_type IN ('ITEM', 'RENTAL', 'DAMAGE', 'MISSING', 'CHALLAN', 'CUSTOM'));

-- Back-fill line types. Challan lines: zero price with the challan label (BillService.CHALLAN_LABEL).
UPDATE bill_item SET line_type = 'CHALLAN'
 WHERE unit_price = 0 AND item_name LIKE '%(rental hand-over, challan)';
-- Rental return bills hold only rental lines.
UPDATE bill_item SET line_type = 'RENTAL'
 WHERE line_type = 'ITEM'
   AND bill_id IN (SELECT bill_id FROM booking WHERE kind = 'RENTAL' AND bill_id IS NOT NULL);
-- Lines without a catalog item (stitching).
UPDATE bill_item SET line_type = 'CUSTOM' WHERE line_type = 'ITEM' AND service_item_id IS NULL;

-- A bill is a challan only if every line is a challan line. A hand-over done from the billing
-- page could mix challan lines into a real sale; that bill stays a BILL.
UPDATE bill SET bill_type = 'CHALLAN'
 WHERE EXISTS (SELECT 1 FROM bill_item i WHERE i.bill_id = bill.id)
   AND NOT EXISTS (SELECT 1 FROM bill_item i WHERE i.bill_id = bill.id AND i.line_type <> 'CHALLAN');

-- 7. Due lists filter by outlet + status (also DB-4 in BUGS_AND_IMPROVEMENTS.md).
CREATE INDEX idx_booking_outlet_status ON booking (outlet_id, status);
