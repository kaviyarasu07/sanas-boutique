package com.sanasboutique.backend.outlet.entity;

/** Timeline steps of a booking. HANDED_OVER, RETURNED and REPAIR are used by jewellery rentals. */
public enum BookingLogKind {
    CREATED,
    EDIT,
    DONE,
    CANCELLED,
    RESCHEDULED,
    AUTO_CANCELLED,
    COMMENT,
    HANDED_OVER,
    RETURNED,
    REPAIR
}
