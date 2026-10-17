package com.sanasboutique.backend.outlet.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.time.LocalDate;
import java.util.List;

/** The customer takes the pieces today: optionally remove booked pieces, add more, and set the return date. */
public record RentalHandOverRequest(
        @NotNull LocalDate returnDate,
        List<@NotNull Long> removeItemIds,
        List<@Valid RentalLine> addItems,
        @Size(max = 150) String authorName) {}
