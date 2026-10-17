package com.sanasboutique.backend.outlet.entity;

/** Status of one garment. NOT_STARTED, STARTED and FINISHED are set by staff (moving back is allowed); DELIVERED and CANCELLED close the garment. */
public enum StitchItemStatus {
    NOT_STARTED,
    STARTED,
    FINISHED,
    DELIVERED,
    CANCELLED;

    public boolean isOpen() {
        return this == NOT_STARTED || this == STARTED || this == FINISHED;
    }
}
