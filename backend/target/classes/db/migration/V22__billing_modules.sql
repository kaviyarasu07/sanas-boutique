-- Franchisor-created billing modules (docs/features/custom-billing-modules.md). A service opens
-- either a built-in module (service.module) or a separate simple billing module created by the
-- franchisor (service.module = 'CUSTOM' + billing_module_id). Their bills carry the same link.

CREATE TABLE billing_module (
    id         BIGSERIAL PRIMARY KEY,
    name       VARCHAR(60) NOT NULL UNIQUE,
    -- Short code in bill numbers (PREFIX-<code>-000123), generated from the name; never changes once bills exist.
    code       VARCHAR(4) NOT NULL UNIQUE CHECK (code ~ '^[A-Z][A-Z0-9]{0,3}$'),
    icon       VARCHAR(20) NOT NULL,
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE service ADD COLUMN billing_module_id BIGINT REFERENCES billing_module(id);
ALTER TABLE service DROP CONSTRAINT chk_service_module;
ALTER TABLE service ADD CONSTRAINT chk_service_module
    CHECK (module IN ('RENTAL', 'PARLOUR', 'STITCHING', 'SALES', 'CUSTOM'));
ALTER TABLE service ADD CONSTRAINT chk_service_billing_module
    CHECK ((module = 'CUSTOM') = (billing_module_id IS NOT NULL));
CREATE INDEX idx_service_billing_module ON service (billing_module_id);

ALTER TABLE bill ADD COLUMN billing_module_id BIGINT REFERENCES billing_module(id);
ALTER TABLE bill DROP CONSTRAINT chk_bill_module;
ALTER TABLE bill ADD CONSTRAINT chk_bill_module
    CHECK (module IN ('RENTAL', 'PARLOUR', 'SALES', 'STITCHING', 'CUSTOM'));
ALTER TABLE bill ADD CONSTRAINT chk_bill_billing_module
    CHECK ((module = 'CUSTOM') = (billing_module_id IS NOT NULL));
CREATE INDEX idx_bill_outlet_billing_module_created ON bill (outlet_id, billing_module_id, created_at DESC);
