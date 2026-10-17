package com.sanasboutique.backend.outlet.dto.response;

import java.math.BigDecimal;
import java.time.*;
import java.util.List;

/**
 * A parlour appointment. status: BOOKED, DONE (billed) or CANCELLED; autoCancelled: cancelled by the
 * 6:00 AM job / first-use sweep ("Not done by end of day"). rescheduledTo / rescheduledFrom: booking
 * numbers linked by "Cancel & reschedule". estimate: sum of service price × quantity.
 */
public record ParlourAppointmentResponse(
        Long id,
        String bookingNumber,
        String status,
        boolean autoCancelled,
        String customerName,
        String customerMobile,
        LocalDate date,
        LocalTime time,
        String notes,
        Instant createdAt,
        List<Item> items,
        BigDecimal estimate,
        BillResponse bill,
        String cancelReason,
        Instant cancelledAt,
        String rescheduledTo,
        String rescheduledFrom) {
    public record Item(Long itemId, String name, String serviceName, BigDecimal price, int quantity) {}
}
