-- Parlour module (docs/features/parlour.md): how a booking ended without a bill, the link created
-- by "Cancel & reschedule", and an append-only timeline per booking.

-- cancel_reason / cancelled_at: set on every cancel. auto_cancelled: cancelled by the 6:00 AM job
-- ("Not done by end of day"), so reports can tell it apart from a customer cancellation.
-- rescheduled_to_id: the new booking created by "Cancel & reschedule".
ALTER TABLE booking
    ADD COLUMN cancel_reason     VARCHAR(200),
    ADD COLUMN cancelled_at      TIMESTAMPTZ,
    ADD COLUMN auto_cancelled    BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN rescheduled_to_id BIGINT REFERENCES booking(id);
ALTER TABLE booking ADD CONSTRAINT chk_booking_auto_cancelled
    CHECK (NOT auto_cancelled OR status = 'CANCELLED');

-- The today list and the 6:00 AM sweep look up bookings by kind, status and date.
CREATE INDEX idx_booking_kind_status_start ON booking (kind, status, start_date);

-- Every step and every staff comment on a booking. Append-only: the app never updates or deletes
-- rows. author_name keeps the name as it was at the time ("System" for the 6:00 AM job).
CREATE TABLE booking_log (
    id          BIGSERIAL PRIMARY KEY,
    outlet_id   BIGINT NOT NULL REFERENCES outlet(id),
    booking_id  BIGINT NOT NULL REFERENCES booking(id),
    kind        VARCHAR(15) NOT NULL CHECK (kind IN
                    ('CREATED', 'EDIT', 'DONE', 'CANCELLED', 'RESCHEDULED', 'AUTO_CANCELLED', 'COMMENT')),
    message     VARCHAR(1000) NOT NULL,
    user_id     BIGINT REFERENCES app_user(id),
    author_name VARCHAR(150) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_booking_log_booking ON booking_log (booking_id, created_at);

-- Start the timeline of existing bookings with what is known.
INSERT INTO booking_log (outlet_id, booking_id, kind, message, author_name, created_at)
SELECT outlet_id, id, 'CREATED', 'Booked', 'Before booking log', created_at FROM booking;
