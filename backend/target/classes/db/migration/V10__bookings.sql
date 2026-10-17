-- Pre-bookings. RENTAL bookings (items of a "Per Day" service, e.g. jewellery) reserve the
-- piece for a date range and are billed on return; APPOINTMENT bookings (e.g. parlour) reserve a
-- date/time and are billed on completion.
CREATE TABLE booking (
    id                   BIGSERIAL PRIMARY KEY,
    outlet_id            BIGINT NOT NULL REFERENCES outlet(id),
    customer_id          BIGINT REFERENCES outlet_customer(id),
    customer_name        VARCHAR(150) NOT NULL,
    customer_mobile      VARCHAR(10) NOT NULL,
    kind                 VARCHAR(20) NOT NULL CHECK (kind IN ('RENTAL', 'APPOINTMENT')),
    status               VARCHAR(20) NOT NULL CHECK (status IN ('BOOKED', 'HANDED_OVER', 'COMPLETED', 'CANCELLED')),
    start_date           DATE NOT NULL,
    start_time           TIME,
    expected_return_date DATE,
    handed_over_on       DATE,
    returned_on          DATE,
    bill_id              BIGINT REFERENCES bill(id),
    notes                VARCHAR(500),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_booking_rental_dates CHECK (kind <> 'RENTAL' OR (expected_return_date IS NOT NULL AND expected_return_date >= start_date))
);
CREATE INDEX idx_booking_outlet_start ON booking(outlet_id, start_date);
CREATE TABLE booking_item (
    id              BIGSERIAL PRIMARY KEY,
    booking_id      BIGINT NOT NULL REFERENCES booking(id) ON DELETE CASCADE,
    service_item_id BIGINT NOT NULL REFERENCES service_item(id),
    CONSTRAINT uq_booking_item UNIQUE (booking_id, service_item_id)
);
CREATE INDEX idx_booking_item_service_item ON booking_item(service_item_id);
