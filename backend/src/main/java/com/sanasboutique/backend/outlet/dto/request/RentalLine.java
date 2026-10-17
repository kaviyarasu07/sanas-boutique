package com.sanasboutique.backend.outlet.dto.request;

import jakarta.validation.constraints.*;

/** One rental piece (product) and how many of it. */
public record RentalLine(@NotNull Long itemId, @Min(1) @Max(1000) int quantity) {}
