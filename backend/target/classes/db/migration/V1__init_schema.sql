-- Baseline schema. Deliberately minimal for now — just enough to prove the
-- Flyway + Postgres wiring works end to end. The full entity set (app_user,
-- jewellery_item, parlour_service, stitching_order, fabric_item, bill,
-- bill_line_item, jewellery_rental, franchise_module) comes in V2+ once the
-- API contract is finalized.
--
-- Rule for every future migration: never edit an applied one — always add
-- a new Vn__description.sql file.

CREATE TABLE franchise (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(150) NOT NULL,
    code            VARCHAR(30)  NOT NULL UNIQUE, -- short slug, used in bill numbering
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE franchise IS 'One row per outlet. Every tenant-scoped table carries franchise_id.';
