-- Accounts. No public sign-up: the first FRANCHISOR account is created once,
-- by a one-time setup screen that only works while no FRANCHISOR exists yet
-- (see AuthController). Every other account (franchise owner, staff) is
-- created by an admin from inside the app - never self-registered.

CREATE TABLE app_user (
    id              BIGSERIAL PRIMARY KEY,
    franchise_id    BIGINT REFERENCES franchise(id),
    username        VARCHAR(50)  NOT NULL UNIQUE,
    mobile_no       VARCHAR(15)  NOT NULL UNIQUE,
    password_hash   VARCHAR(100) NOT NULL,
    full_name       VARCHAR(150) NOT NULL,
    role            VARCHAR(30)  NOT NULL,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT chk_app_user_role
        CHECK (role IN ('FRANCHISOR', 'FRANCHISE_OWNER', 'STAFF')),

    -- A franchisor is a cross-outlet admin and belongs to no single
    -- franchise; every other role must belong to exactly one.
    CONSTRAINT chk_app_user_franchise_scope
        CHECK (
            (role = 'FRANCHISOR' AND franchise_id IS NULL)
            OR (role <> 'FRANCHISOR' AND franchise_id IS NOT NULL)
        )
);

CREATE INDEX idx_app_user_franchise_id ON app_user (franchise_id);

COMMENT ON TABLE app_user IS 'Login accounts. role FRANCHISOR has franchise_id NULL and can see every outlet; other roles are scoped to their franchise_id.';
