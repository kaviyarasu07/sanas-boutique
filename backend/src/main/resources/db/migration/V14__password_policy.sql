-- Forced first-login password change and OTP-based "forgot password".
ALTER TABLE app_user
    ADD COLUMN password_change_required BOOLEAN     NOT NULL DEFAULT FALSE,
    ADD COLUMN password_changed_at      TIMESTAMPTZ,
    ADD COLUMN reset_otp_hash           VARCHAR(100),
    ADD COLUMN reset_otp_expires_at     TIMESTAMPTZ,
    ADD COLUMN reset_otp_attempts       INT         NOT NULL DEFAULT 0;

-- Existing outlets still use a system-generated password: make them change it.
UPDATE app_user SET password_change_required = TRUE WHERE role = 'OUTLET';

-- Admin-chosen passwords count as already personal.
UPDATE app_user SET password_changed_at = now() WHERE role <> 'OUTLET';

COMMENT ON COLUMN app_user.password_changed_at IS 'NULL while the account still has a system-generated password; forgot-password (OTP) is only offered once this is set.';
