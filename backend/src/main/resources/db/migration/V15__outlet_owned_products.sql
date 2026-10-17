-- Products now belong to one outlet, each with its own name, price and stock.
-- Admin only controls services (and which outlets may use them). Stock lives on
-- service_item.quantity itself; outlet_service_item is no longer used by the app.

ALTER TABLE service_item ADD COLUMN outlet_id BIGINT REFERENCES outlet(id);
CREATE INDEX idx_service_item_outlet_id ON service_item (outlet_id);
CREATE INDEX idx_service_item_outlet_service ON service_item (outlet_id, service_id);

-- Carry existing data over. An item allocated to several outlets is split: the
-- first outlet keeps the original row, every other outlet gets its own copy
-- (with its allocated quantity) and its past bills/bookings are re-pointed.
-- Items never allocated to any outlet stay with outlet_id NULL (hidden).
DO $$
DECLARE
    a RECORD;
    first_outlet BIGINT;
    new_id BIGINT;
BEGIN
    FOR a IN
        SELECT osi.outlet_id, osi.service_item_id, osi.allocated_quantity, osi.is_active
        FROM outlet_service_item osi
        ORDER BY osi.service_item_id, osi.outlet_id
    LOOP
        SELECT outlet_id INTO first_outlet FROM service_item WHERE id = a.service_item_id;
        IF first_outlet IS NULL THEN
            UPDATE service_item
               SET outlet_id = a.outlet_id,
                   quantity = COALESCE(a.allocated_quantity, quantity),
                   is_active = is_active AND a.is_active
             WHERE id = a.service_item_id;
        ELSE
            INSERT INTO service_item (service_id, name, description, price, quantity, is_active, outlet_id)
            SELECT service_id, name, description, price,
                   COALESCE(a.allocated_quantity, quantity), is_active AND a.is_active, a.outlet_id
              FROM service_item WHERE id = a.service_item_id
            RETURNING id INTO new_id;
            UPDATE service_item SET item_code = 'SB-' || lpad(new_id::text, 6, '0') WHERE id = new_id;
            UPDATE bill_item SET service_item_id = new_id
             WHERE service_item_id = a.service_item_id
               AND bill_id IN (SELECT id FROM bill WHERE outlet_id = a.outlet_id);
            UPDATE booking_item SET service_item_id = new_id
             WHERE service_item_id = a.service_item_id
               AND booking_id IN (SELECT id FROM booking WHERE outlet_id = a.outlet_id);
        END IF;
    END LOOP;
END $$;

ALTER TABLE service_item ADD CONSTRAINT chk_service_item_price CHECK (price >= 0);
COMMENT ON COLUMN service_item.outlet_id IS 'Owning outlet. Price and quantity are that outlet''s own; NULL only for legacy HQ items that were never allocated.';
