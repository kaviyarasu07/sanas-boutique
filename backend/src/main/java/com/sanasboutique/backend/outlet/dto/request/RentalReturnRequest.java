package com.sanasboutique.backend.outlet.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.util.List;

/**
 * Return check, one entry per piece given: ok + damaged + missing = quantity given; repairQty (part
 * of damaged) goes for repair instead of back to stock. A damaged or missing quantity needs its
 * charge (0 is allowed, to waive it on purpose).
 */
public record RentalReturnRequest(
        @DecimalMin("0") @Digits(integer = 8, fraction = 2) BigDecimal discount,
        @NotEmpty List<@Valid Piece> items,
        @Size(max = 150) String authorName) {
    public record Piece(
            @NotNull Long itemId,
            @Min(0) int okQty,
            @Min(0) int damagedQty,
            @Min(0) int repairQty,
            @Min(0) int missingQty,
            @DecimalMin("0") @Digits(integer = 8, fraction = 2) BigDecimal damageCharge,
            @Size(max = 200) String damageNote,
            @DecimalMin("0") @Digits(integer = 8, fraction = 2) BigDecimal missingCharge) {}
}
