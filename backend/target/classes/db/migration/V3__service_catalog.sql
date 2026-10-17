-- Unified catalog: one shape for every business line the franchise offers
-- (jewelry rental, parlour services, fabric stitching, fabric/garment sales,
-- and anything added later) instead of a separate table per line.
--
--   price_unit    - shared, admin-growable list of what a price means
--                    (Flat, Per Day, Per Hour, Per Meter, Per Piece, ...)
--   service       - a business line, e.g. "Jewelry Rental" or "Parlor".
--                    Pricing style is fixed per service (confirmed with the
--                    client): every item under a service shares its
--                    price_unit.
--   service_category - admin-defined grouping inside a service, for
--                    browsing/search only (e.g. "Facial", "Silver Coated").
--   service_item  - the actual sellable/rentable thing. barcode, unique_code
--                    and quantity are all optional - filled in for stock-
--                    tracked items (jewelry, fabric, garments), left blank
--                    for pure labor services (facial, stitching job).
--   service_item_image - one item, many photos.

CREATE TABLE price_unit (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(50) NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO price_unit (name) VALUES
    ('Flat'), ('Per Day'), ('Per Hour'), ('Per Meter'), ('Per Piece');

CREATE TABLE service (
    id             BIGSERIAL PRIMARY KEY,
    name           VARCHAR(150) NOT NULL UNIQUE,
    description    VARCHAR(255),
    price_unit_id  BIGINT NOT NULL REFERENCES price_unit(id),
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_service_price_unit_id ON service (price_unit_id);

CREATE TABLE service_category (
    id          BIGSERIAL PRIMARY KEY,
    service_id  BIGINT NOT NULL REFERENCES service(id),
    name        VARCHAR(100) NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_service_category_name UNIQUE (service_id, name)
);

CREATE INDEX idx_service_category_service_id ON service_category (service_id);

CREATE TABLE service_item (
    id           BIGSERIAL PRIMARY KEY,
    category_id  BIGINT NOT NULL REFERENCES service_category(id),
    name         VARCHAR(150) NOT NULL,
    description  VARCHAR(255),
    barcode      VARCHAR(50) UNIQUE,
    unique_code  VARCHAR(50) UNIQUE,
    price        NUMERIC(10,2) NOT NULL,
    quantity     INT,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_service_item_quantity CHECK (quantity IS NULL OR quantity >= 0)
);

CREATE INDEX idx_service_item_category_id ON service_item (category_id);
CREATE INDEX idx_service_item_barcode ON service_item (barcode);

CREATE TABLE service_item_image (
    id          BIGSERIAL PRIMARY KEY,
    item_id     BIGINT NOT NULL REFERENCES service_item(id) ON DELETE CASCADE,
    image_url   VARCHAR(500) NOT NULL,
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_service_item_image_item_id ON service_item_image (item_id);
