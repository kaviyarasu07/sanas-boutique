package com.sanasboutique.backend.outlet.dto.response;

import java.math.BigDecimal;
import java.time.*;
import java.util.List;

/**
 * status: OPEN / DELIVERED / CANCELLED (each garment has its own status). estimatedDeliveryDate: the
 * next delivery date (earliest garment not yet delivered; else the last garment's date).
 * total: sum of priced garments not cancelled; unpricedCount: garments still without a price.
 * Advance: advancePaid (all advances) - advanceUsed (taken off bills) - refunded - kept = advanceAvailable.
 * bills: delivery bills made so far; payments: advances and refunds.
 * fabricSource: OWN or IN_HOUSE ("In-house purchase"); fabricBill: the linked shop bill, if any.
 */
public record StitchOrderResponse(
        Long id,
        String orderNumber,
        String status,
        String customerName,
        String customerMobile,
        LocalDate estimatedDeliveryDate,
        String notes,
        Instant createdAt,
        List<Item> items,
        BigDecimal total,
        int unpricedCount,
        BigDecimal advancePaid,
        BigDecimal advanceUsed,
        BigDecimal refunded,
        BigDecimal kept,
        BigDecimal advanceAvailable,
        List<BillResponse> bills,
        List<Payment> payments,
        String fabricSource,
        FabricBill fabricBill) {
    public record Item(
            Long id,
            String garment,
            String measurements,
            String notes,
            BigDecimal amount,
            String status,
            LocalDate deliveryDate,
            LocalDate measuredOn,
            Instant startedAt,
            Instant finishedAt,
            Instant deliveredAt,
            Instant cancelledAt,
            String cancelReason,
            String billNumber) {}

    public record Payment(
            Long id,
            String kind,
            BigDecimal amount,
            BigDecimal keptAmount,
            String refundNumber,
            String reason,
            String authorName,
            Instant createdAt) {}

    public record FabricBill(Long id, String billNumber, BigDecimal total, String summary) {}
}
