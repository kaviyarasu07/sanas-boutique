package com.sanasboutique.backend.outlet.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.time.*;
import java.util.List;

/** startTime: appointments; expectedReturnDate: rentals. Delivery bookings need only startDate (the delivery date). */
public record BookingRequest(
        @NotBlank @Size(max = 150) String customerName,
        @NotBlank @Size(max = 15) String customerMobile,
        @NotNull LocalDate startDate,
        LocalTime startTime,
        LocalDate expectedReturnDate,
        @NotEmpty List<@Valid Line> items,
        @Size(max = 500) String notes) {
    public record Line(@NotNull Long itemId, @Min(1) @Max(1000) int quantity) {}
}
