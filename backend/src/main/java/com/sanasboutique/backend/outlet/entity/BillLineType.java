package com.sanasboutique.backend.outlet.entity;

/**
 * What a bill line is for. ITEM: a product sold at its price. RENTAL: rent (quantity = days x pieces).
 * DAMAGE / MISSING: charges from a rental return. CHALLAN: a no-amount hand-over line. CUSTOM: a line
 * with no catalog item (stitching).
 */
public enum BillLineType {
    ITEM,
    RENTAL,
    DAMAGE,
    MISSING,
    CHALLAN,
    CUSTOM
}
