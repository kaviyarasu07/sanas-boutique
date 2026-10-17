-- How a service is pre-booked (set by the admin per service; NULL = automatic):
--   RENTAL      date range, billed on return        (e.g. jewellery, Per Day)
--   APPOINTMENT date + time, billed on completion   (e.g. parlour)
--   DELIVERY    delivery date, billed on delivery   (e.g. stitching)
--   NONE        cannot be pre-booked
ALTER TABLE service ADD COLUMN booking_mode VARCHAR(20)
    CHECK (booking_mode IS NULL OR booking_mode IN ('RENTAL', 'APPOINTMENT', 'DELIVERY', 'NONE'));

ALTER TABLE booking DROP CONSTRAINT booking_kind_check;
ALTER TABLE booking ADD CONSTRAINT booking_kind_check CHECK (kind IN ('RENTAL', 'APPOINTMENT', 'DELIVERY'));
-- Rentals: the zero-amount delivery challan created at hand-over (the priced bill is bill_id, created on return).
ALTER TABLE booking ADD COLUMN challan_bill_id BIGINT REFERENCES bill(id);

ALTER TABLE booking_item ADD COLUMN quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0);
