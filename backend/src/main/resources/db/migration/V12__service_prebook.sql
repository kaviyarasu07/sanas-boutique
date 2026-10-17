-- Simple yes/no: can items of this service be pre-booked? (booking_mode only picks the kind of booking.)
ALTER TABLE service ADD COLUMN prebook_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Jewellery rental and parlour are pre-bookable from the start, plus anything an admin already configured.
UPDATE service SET prebook_enabled = TRUE
 WHERE lower(name) LIKE '%jewel%' OR lower(name) LIKE '%parlo%'
    OR booking_mode IN ('RENTAL', 'APPOINTMENT', 'DELIVERY');
-- "Cannot be pre-booked" is now simply prebook_enabled = false.
UPDATE service SET booking_mode = NULL WHERE booking_mode = 'NONE';
