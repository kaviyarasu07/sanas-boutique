-- Outlet modules (docs/features/outlet-modules.md) and stitching orders with per-garment dates,
-- partial delivery, advances, refunds and an order log (docs/features/stitching-orders.md).

-- ===== 1. Modules ============================================================================

-- Every service belongs to exactly one module. Replaces the indirect booking_mode / prebook_enabled
-- / "Per Day" guess; those columns are kept (no longer used by the app) so this can be rolled back.
ALTER TABLE service ADD COLUMN module VARCHAR(20) NOT NULL DEFAULT 'SALES'
    CONSTRAINT chk_service_module CHECK (module IN ('RENTAL', 'PARLOUR', 'SALES'));
UPDATE service s
   SET module = CASE
       WHEN s.booking_mode = 'RENTAL' OR lower(pu.name) = 'per day' OR lower(s.name) LIKE '%jewel%' THEN 'RENTAL'
       WHEN s.booking_mode = 'APPOINTMENT' OR lower(s.name) LIKE '%parlo%' THEN 'PARLOUR'
       ELSE 'SALES'
   END
  FROM price_unit pu
 WHERE pu.id = s.price_unit_id;
ALTER TABLE service ALTER COLUMN module DROP DEFAULT;

-- Every bill belongs to exactly one module. legacy_mixed marks old bills that mixed modules
-- (allowed before this change); they are filed under SALES and labelled in reports.
ALTER TABLE bill ADD COLUMN module VARCHAR(20) NOT NULL DEFAULT 'SALES'
    CONSTRAINT chk_bill_module CHECK (module IN ('RENTAL', 'PARLOUR', 'SALES', 'STITCHING'));
ALTER TABLE bill ADD COLUMN legacy_mixed BOOLEAN NOT NULL DEFAULT FALSE;

-- a) From the bill's catalog items: one module -> that module; several -> mixed.
WITH item_modules AS (
    SELECT bi.bill_id, min(s.module) AS module, count(DISTINCT s.module) AS modules
      FROM bill_item bi
      JOIN service_item si ON si.id = bi.service_item_id
      JOIN service s ON s.id = si.service_id
     GROUP BY bi.bill_id
)
UPDATE bill b
   SET module = CASE WHEN im.modules = 1 THEN im.module ELSE 'SALES' END,
       legacy_mixed = im.modules > 1
  FROM item_modules im
 WHERE im.bill_id = b.id;
-- b) Stitching bills (lines without catalog items).
UPDATE bill SET module = 'STITCHING', legacy_mixed = FALSE
 WHERE id IN (SELECT bill_id FROM stitch_order WHERE bill_id IS NOT NULL);
-- c) Rental return bills and challans.
UPDATE bill SET module = 'RENTAL', legacy_mixed = FALSE
 WHERE bill_type = 'CHALLAN'
    OR id IN (SELECT bill_id FROM booking WHERE kind = 'RENTAL' AND bill_id IS NOT NULL);
ALTER TABLE bill ALTER COLUMN module DROP DEFAULT;

CREATE INDEX idx_bill_outlet_module_created ON bill (outlet_id, module, created_at DESC);

-- ===== 2. Stitching: garment-level dates, status and delivery ================================

-- Advance used on this bill (stitching delivery bills; 0 elsewhere). Balance = total - advance_paid.
ALTER TABLE bill ADD COLUMN advance_paid NUMERIC(10,2) NOT NULL DEFAULT 0
    CONSTRAINT chk_bill_advance_paid CHECK (advance_paid >= 0 AND advance_paid <= total);

-- Each garment has its own delivery date and status, and is billed by the delivery that took it.
ALTER TABLE stitch_item
    ADD COLUMN status                  VARCHAR(15),
    ADD COLUMN estimated_delivery_date DATE,
    ADD COLUMN measured_on             DATE,
    ADD COLUMN started_at              TIMESTAMPTZ,
    ADD COLUMN finished_at             TIMESTAMPTZ,
    ADD COLUMN delivered_at            TIMESTAMPTZ,
    ADD COLUMN cancelled_at            TIMESTAMPTZ,
    ADD COLUMN cancel_reason           VARCHAR(200),
    ADD COLUMN bill_id                 BIGINT REFERENCES bill(id);

-- Carry over from the order (owner decision: In progress -> Started, Ready -> Finished).
UPDATE stitch_item i
   SET status = CASE o.status
           WHEN 'IN_PROGRESS' THEN 'STARTED'
           WHEN 'READY'       THEN 'FINISHED'
           ELSE o.status            -- DELIVERED, CANCELLED
       END,
       estimated_delivery_date = o.estimated_delivery_date,
       measured_on  = (o.created_at AT TIME ZONE 'Asia/Kolkata')::date,
       finished_at  = o.ready_at,
       delivered_at = o.delivered_at,
       cancelled_at = CASE WHEN o.status = 'CANCELLED' THEN o.updated_at END,
       bill_id      = CASE WHEN o.status = 'DELIVERED' THEN o.bill_id END
  FROM stitch_order o
 WHERE o.id = i.order_id;

ALTER TABLE stitch_item ALTER COLUMN status SET NOT NULL;
ALTER TABLE stitch_item ALTER COLUMN estimated_delivery_date SET NOT NULL;
ALTER TABLE stitch_item
    ADD CONSTRAINT chk_stitch_item_status
        CHECK (status IN ('NOT_STARTED', 'STARTED', 'FINISHED', 'DELIVERED', 'CANCELLED')),
    ADD CONSTRAINT chk_stitch_item_delivered_bill CHECK (status <> 'DELIVERED' OR bill_id IS NOT NULL),
    ADD CONSTRAINT chk_stitch_item_amount CHECK (amount IS NULL OR amount >= 0);
CREATE INDEX idx_stitch_item_open_delivery ON stitch_item (estimated_delivery_date)
    WHERE status IN ('NOT_STARTED', 'STARTED', 'FINISHED');
CREATE INDEX idx_stitch_item_bill ON stitch_item (bill_id);

-- The order status becomes a summary kept by the service: OPEN until every garment is delivered
-- or cancelled. The order-level delivery date and bill are kept for old data only.
ALTER TABLE stitch_order DROP CONSTRAINT stitch_order_status_check;
UPDATE stitch_order SET status = 'OPEN' WHERE status IN ('IN_PROGRESS', 'READY');
ALTER TABLE stitch_order ADD CONSTRAINT chk_stitch_order_status CHECK (status IN ('OPEN', 'DELIVERED', 'CANCELLED'));
ALTER TABLE stitch_order ALTER COLUMN estimated_delivery_date DROP NOT NULL;
COMMENT ON COLUMN stitch_order.estimated_delivery_date IS 'Legacy (before V17): delivery dates now live on stitch_item.';
COMMENT ON COLUMN stitch_order.bill_id IS 'Legacy (before V17): each delivered garment now points to its bill (stitch_item.bill_id).';
CREATE INDEX idx_stitch_order_outlet_status ON stitch_order (outlet_id, status);

-- Fabric bought at the shop for this order (optional).
ALTER TABLE stitch_order ADD COLUMN fabric_bill_id BIGINT REFERENCES bill(id);

-- ===== 3. Stitching: advances and refunds ===================================================

-- ADVANCE: money taken before delivery (several allowed). REFUND: settling leftover advance on
-- cancel or close; amount = returned to the customer, kept_amount = kept by the shop (reported as
-- "Cancellation charges"). refund_number is printed on the refund challan; derived from the id, so
-- it is set right after insert (nullable for that instant only).
CREATE TABLE stitch_payment (
    id            BIGSERIAL PRIMARY KEY,
    outlet_id     BIGINT NOT NULL REFERENCES outlet(id),
    order_id      BIGINT NOT NULL REFERENCES stitch_order(id),
    kind          VARCHAR(10) NOT NULL CHECK (kind IN ('ADVANCE', 'REFUND')),
    amount        NUMERIC(10,2) NOT NULL,
    kept_amount   NUMERIC(10,2),
    refund_number VARCHAR(30) UNIQUE,
    reason        VARCHAR(200),
    user_id       BIGINT REFERENCES app_user(id),
    author_name   VARCHAR(150) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_stitch_payment_amounts CHECK (
        (kind = 'ADVANCE' AND amount > 0 AND kept_amount IS NULL AND refund_number IS NULL)
        OR (kind = 'REFUND' AND amount >= 0 AND kept_amount >= 0 AND amount + kept_amount > 0))
);
CREATE INDEX idx_stitch_payment_order ON stitch_payment (order_id);
CREATE INDEX idx_stitch_payment_outlet_created ON stitch_payment (outlet_id, created_at);

-- ===== 4. Stitching: order log ==============================================================

-- Every step and every staff comment. Append-only: the app never updates or deletes rows.
-- author_name keeps the name as it was at the time; item_id is cleared if a garment is removed.
CREATE TABLE stitch_order_log (
    id          BIGSERIAL PRIMARY KEY,
    outlet_id   BIGINT NOT NULL REFERENCES outlet(id),
    order_id    BIGINT NOT NULL REFERENCES stitch_order(id),
    item_id     BIGINT REFERENCES stitch_item(id) ON DELETE SET NULL,
    kind        VARCHAR(15) NOT NULL CHECK (kind IN
                    ('CREATED', 'STATUS', 'EDIT', 'ADVANCE', 'DATE', 'DELIVERED', 'CANCELLED', 'REFUND', 'COMMENT')),
    message     VARCHAR(1000) NOT NULL,
    from_value  VARCHAR(200),
    to_value    VARCHAR(200),
    user_id     BIGINT REFERENCES app_user(id),
    author_name VARCHAR(150) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_stitch_order_log_order ON stitch_order_log (order_id, created_at);

-- Start the timeline of existing orders with what is known.
INSERT INTO stitch_order_log (outlet_id, order_id, kind, message, author_name, created_at)
SELECT outlet_id, id, 'CREATED', 'Order created', 'Before order log', created_at FROM stitch_order;
INSERT INTO stitch_order_log (outlet_id, order_id, kind, message, author_name, created_at)
SELECT o.outlet_id, o.id, 'DELIVERED', 'Delivered · bill ' || b.bill_number, 'Before order log', o.delivered_at
  FROM stitch_order o JOIN bill b ON b.id = o.bill_id
 WHERE o.status = 'DELIVERED' AND o.delivered_at IS NOT NULL;
