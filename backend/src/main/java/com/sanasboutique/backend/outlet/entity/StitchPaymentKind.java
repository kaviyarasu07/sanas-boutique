package com.sanasboutique.backend.outlet.entity;

/** ADVANCE: money taken before delivery. REFUND: leftover advance settled on cancel or close (returned + kept). */
public enum StitchPaymentKind {
    ADVANCE,
    REFUND
}
