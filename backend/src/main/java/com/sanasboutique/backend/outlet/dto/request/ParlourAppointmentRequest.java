package com.sanasboutique.backend.outlet.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

/** Book parlour services for a day and time (time is required). */
public record ParlourAppointmentRequest(
        @NotBlank @Size(max = 150) String customerName,
        @NotBlank @Size(max = 15) String customerMobile,
        @NotNull LocalDate date,
        @NotNull LocalTime time,
        @NotEmpty List<@Valid ParlourLine> lines,
        @Size(max = 500) String notes,
        @Size(max = 150) String authorName) {}
