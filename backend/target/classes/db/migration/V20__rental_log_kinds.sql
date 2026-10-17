-- Jewellery rental module (docs/features/jewellery-rental-flow.md, v3): the booking timeline
-- (booking_log, V19) also records hand-over, return and repair steps of rentals.
ALTER TABLE booking_log DROP CONSTRAINT booking_log_kind_check;
ALTER TABLE booking_log ADD CONSTRAINT booking_log_kind_check CHECK (kind IN
    ('CREATED', 'EDIT', 'DONE', 'CANCELLED', 'RESCHEDULED', 'AUTO_CANCELLED', 'COMMENT',
     'HANDED_OVER', 'RETURNED', 'REPAIR'));
