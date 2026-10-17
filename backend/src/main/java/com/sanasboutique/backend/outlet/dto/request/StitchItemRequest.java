package com.sanasboutique.backend.outlet.dto.request;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * One garment. amount (price) is optional until the garment is billed. copiedFromItemId: the earlier
 * garment whose measurements were reused ("Use previous measurements"); keeps their original date.
 * authorName: optional "Your name" for the order log (one login per outlet today).
 */
public record StitchItemRequest(
        @NotBlank @Size(max = 150) String garment,
        @Size(max = 2000) String measurements,
        @Size(max = 1000) String notes,
        @NotNull LocalDate deliveryDate,
        @DecimalMin("0") @Digits(integer = 8, fraction = 2) BigDecimal amount,
        Long copiedFromItemId,
        @Size(max = 150) String authorName) {}
