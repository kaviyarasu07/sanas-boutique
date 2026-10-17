-- Stitching orders: measurements are taken and a delivery date estimated first; the amount is
-- added when the garment is ready; the customer is billed on delivery.
CREATE TABLE stitch_order (
    id                      BIGSERIAL PRIMARY KEY,
    outlet_id               BIGINT NOT NULL REFERENCES outlet(id),
    order_number            VARCHAR(60) NOT NULL UNIQUE,
    customer_id             BIGINT REFERENCES outlet_customer(id),
    customer_name           VARCHAR(150) NOT NULL,
    customer_mobile         VARCHAR(10) NOT NULL,
    status                  VARCHAR(20) NOT NULL CHECK (status IN ('IN_PROGRESS', 'READY', 'DELIVERED', 'CANCELLED')),
    estimated_delivery_date DATE NOT NULL,
    notes                   VARCHAR(1000),
    ready_at                TIMESTAMPTZ,
    delivered_at            TIMESTAMPTZ,
    bill_id                 BIGINT REFERENCES bill(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_stitch_order_outlet_delivery ON stitch_order(outlet_id, estimated_delivery_date);
CREATE TABLE stitch_item (
    id           BIGSERIAL PRIMARY KEY,
    order_id     BIGINT NOT NULL REFERENCES stitch_order(id) ON DELETE CASCADE,
    garment      VARCHAR(150) NOT NULL,
    measurements VARCHAR(2000),
    notes        VARCHAR(1000),
    amount       NUMERIC(10,2)
);
CREATE INDEX idx_stitch_item_order ON stitch_item(order_id);

-- Stitching bill lines have no catalog item; they carry their own service label instead.
ALTER TABLE bill_item ALTER COLUMN service_item_id DROP NOT NULL;
ALTER TABLE bill_item ADD COLUMN service_label VARCHAR(100);
