package com.sanasboutique.backend.outlet.dto.request;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;

public record StitchAdvanceRequest(
        @NotNull @DecimalMin("0.01") @Digits(integer = 8, fraction = 2) BigDecimal amount,
        @Size(max = 150) String authorName) {}
