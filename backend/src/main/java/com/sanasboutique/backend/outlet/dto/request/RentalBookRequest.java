package com.sanasboutique.backend.outlet.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.time.LocalDate;
import java.util.List;

/** Pre-book pieces for [startDate, returnDate] (startDate today or later). "Rent now" uses the same body; its startDate is ignored (today). */
public record RentalBookRequest(
        @NotBlank @Size(max = 150) String customerName,
        @NotBlank @Size(max = 15) String customerMobile,
        LocalDate startDate,
        @NotNull LocalDate returnDate,
        @NotEmpty List<@Valid RentalLine> lines,
        @Size(max = 500) String notes,
        @Size(max = 150) String authorName) {}
