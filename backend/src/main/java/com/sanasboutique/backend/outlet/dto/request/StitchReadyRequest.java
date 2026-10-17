package com.sanasboutique.backend.outlet.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.util.List;

/** The amount to charge for each garment, entered when the order is ready. */
public record StitchReadyRequest(@NotEmpty List<@Valid ItemAmount> amounts) {
    public record ItemAmount(
            @NotNull Long itemId, @NotNull @DecimalMin("0.01") BigDecimal amount) {}
}
