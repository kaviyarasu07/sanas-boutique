package com.sanasboutique.backend.outlet.dto.response;

import java.math.BigDecimal;
import java.time.*;
import java.util.List;

/**
 * A jewellery rental. status: BOOKED (pre-booked), WITH_CUSTOMER, RETURNED (billed) or CANCELLED;
 * autoCancelled = not collected by the booked date (cancelled by the system). days and estimate:
 * planned (or actual once returned; a late rental counts up to today). challan: the hand-over slip;
 * bill: the final rental bill. Per piece: what was given and, after the return, what came back.
 */
public record RentalBookingResponse(
        Long id,
        String bookingNumber,
        String status,
        boolean autoCancelled,
        String customerName,
        String customerMobile,
        LocalDate startDate,
        LocalDate returnDate,
        LocalDate handedOverOn,
        LocalDate returnedOn,
        String notes,
        Instant createdAt,
        List<Item> items,
        int days,
        BigDecimal estimate,
        BillResponse challan,
        BillResponse bill,
        String cancelReason,
        String rescheduledTo,
        String rescheduledFrom) {
    public record Item(
            Long itemId,
            String name,
            String itemCode,
            BigDecimal pricePerDay,
            int quantity,
            int addedQty,
            Integer okQty,
            Integer damagedQty,
            Integer repairQty,
            Integer missingQty,
            BigDecimal damageCharge,
            String damageNote,
            BigDecimal missingCharge,
            BigDecimal replacementValue) {}
}
