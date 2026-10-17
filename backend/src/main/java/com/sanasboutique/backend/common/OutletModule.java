package com.sanasboutique.backend.common;

/**
 * The outlet's lines of business (docs/features/outlet-modules.md). Every service belongs to one of
 * RENTAL, PARLOUR or SALES; every bill to one of all four (STITCHING bills have no catalog items).
 * CUSTOM: a franchisor-created billing module (see BillingModule). Display names live in the
 * frontend (config/modules.ts).
 */
public enum OutletModule {
    RENTAL,
    PARLOUR,
    SALES,
    STITCHING,
    /** A simple billing module created by the franchisor (catalog BillingModule); the record also links which one. */
    CUSTOM
}
