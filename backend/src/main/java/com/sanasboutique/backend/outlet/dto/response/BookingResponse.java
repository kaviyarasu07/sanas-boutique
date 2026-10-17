package com.sanasboutique.backend.outlet.dto.response;

import java.math.BigDecimal;
import java.time.*;
import java.util.List;

/** estimatedAmount: rentals = price per day x quantity x days (hand-over, or planned start, to the expected return; minimum 1); others = sum of price x quantity. challan: the zero-amount delivery challan of a handed-over rental; bill: the final priced bill. */
public record BookingResponse(
        Long id,
        String kind,
        String status,
        String customerName,
        String customerMobile,
        LocalDate startDate,
        LocalTime startTime,
        LocalDate expectedReturnDate,
        LocalDate handedOverOn,
        LocalDate returnedOn,
        String notes,
        Instant createdAt,
        List<Item> items,
        BigDecimal estimatedAmount,
        BillResponse bill,
        BillResponse challan) {
    public record Item(
            Long itemId,
            String name,
            String itemCode,
            String serviceName,
            BigDecimal unitPrice,
            int quantity) {}
}
