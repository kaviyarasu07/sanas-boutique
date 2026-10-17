package com.sanasboutique.backend.outlet.dto.request;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;

/** amount: given back to the customer, decided by the outlet; the rest of the advance left is kept by the shop. */
public record StitchRefundRequest(
        @NotNull @DecimalMin("0") @Digits(integer = 8, fraction = 2) BigDecimal amount,
        @Size(max = 200) String reason,
        @Size(max = 150) String authorName) {}
