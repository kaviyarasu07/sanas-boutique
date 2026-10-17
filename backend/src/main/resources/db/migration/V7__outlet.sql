ALTER TABLE app_user DROP CONSTRAINT chk_app_user_role;
ALTER TABLE app_user ADD CONSTRAINT chk_app_user_role
    CHECK (role IN ('FRANCHISOR', 'FRANCHISE_OWNER', 'STAFF', 'OUTLET'));

CREATE TABLE outlet (
    id              BIGSERIAL PRIMARY KEY,
    franchise_id    BIGINT NOT NULL UNIQUE REFERENCES franchise(id),
    name            VARCHAR(150) NOT NULL,
    owner_name      VARCHAR(150) NOT NULL,
    address         VARCHAR(500),
    mobile_number   VARCHAR(15) NOT NULL UNIQUE,
    email           VARCHAR(254) NOT NULL UNIQUE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    app_user_id     BIGINT NOT NULL UNIQUE REFERENCES app_user(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_outlet_franchise_id ON outlet (franchise_id);
CREATE INDEX idx_outlet_app_user_id ON outlet (app_user_id);

CREATE TABLE outlet_service (
    id          BIGSERIAL PRIMARY KEY,
    outlet_id   BIGINT NOT NULL REFERENCES outlet(id) ON DELETE CASCADE,
    service_id  BIGINT NOT NULL REFERENCES service(id) ON DELETE CASCADE,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_outlet_service UNIQUE (outlet_id, service_id)
);
CREATE INDEX idx_outlet_service_outlet_id ON outlet_service (outlet_id);
CREATE INDEX idx_outlet_service_service_id ON outlet_service (service_id);

CREATE TABLE outlet_service_item (
    id                 BIGSERIAL PRIMARY KEY,
    outlet_id          BIGINT NOT NULL REFERENCES outlet(id) ON DELETE CASCADE,
    service_item_id    BIGINT NOT NULL REFERENCES service_item(id) ON DELETE CASCADE,
    allocated_quantity INT,
    is_active          BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_outlet_service_item UNIQUE (outlet_id, service_item_id),
    CONSTRAINT chk_outlet_service_item_quantity CHECK (allocated_quantity IS NULL OR allocated_quantity >= 0)
);
CREATE INDEX idx_outlet_service_item_outlet_id ON outlet_service_item (outlet_id);
CREATE INDEX idx_outlet_service_item_service_item_id ON outlet_service_item (service_item_id);
