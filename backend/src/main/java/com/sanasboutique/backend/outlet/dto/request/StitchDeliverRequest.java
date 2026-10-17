package com.sanasboutique.backend.outlet.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.util.List;

/** Deliver the selected finished garments now and bill them. prices: for garments still without a price (or a last change). */
public record StitchDeliverRequest(
        @NotEmpty List<@NotNull Long> itemIds,
        List<@Valid Price> prices,
        @DecimalMin("0") @Digits(integer = 8, fraction = 2) BigDecimal discount,
        @Size(max = 150) String authorName) {
    public record Price(
            @NotNull Long itemId,
            @NotNull @DecimalMin("0") @Digits(integer = 8, fraction = 2) BigDecimal amount) {}
}
