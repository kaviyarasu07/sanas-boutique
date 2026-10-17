package com.sanasboutique.backend.outlet.entity;

/** Summary status of a stitching order, kept by the service: OPEN until every garment is delivered or cancelled. Garments have their own status (StitchItemStatus). */
public enum StitchStatus {
    OPEN,
    DELIVERED,
    CANCELLED
}
