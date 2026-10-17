package com.sanasboutique.backend.outlet.dto.request;

import jakarta.validation.constraints.*;

import java.time.LocalDate;

/** "Cancel & reschedule" a pre-booking: the same pieces for new dates (availability checked again). */
public record RentalRescheduleRequest(
        @NotNull LocalDate startDate, @NotNull LocalDate returnDate, @Size(max = 150) String authorName) {}
