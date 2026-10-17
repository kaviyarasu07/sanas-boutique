CREATE TABLE bill (
    id BIGSERIAL PRIMARY KEY,
    outlet_id BIGINT NOT NULL REFERENCES outlet(id),
    bill_number VARCHAR(30) NOT NULL UNIQUE,
    customer_name VARCHAR(150) NOT NULL,
    customer_mobile VARCHAR(15) NOT NULL,
    discount NUMERIC(10,2) NOT NULL DEFAULT 0,
    subtotal NUMERIC(10,2) NOT NULL,
    total NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bill_outlet_created ON bill(outlet_id, created_at DESC);
CREATE TABLE bill_item (
    id BIGSERIAL PRIMARY KEY,
    bill_id BIGINT NOT NULL REFERENCES bill(id) ON DELETE CASCADE,
    service_item_id BIGINT NOT NULL REFERENCES service_item(id),
    item_name VARCHAR(150) NOT NULL,
    item_code VARCHAR(50),
    unit_price NUMERIC(10,2) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    line_total NUMERIC(10,2) NOT NULL
);
