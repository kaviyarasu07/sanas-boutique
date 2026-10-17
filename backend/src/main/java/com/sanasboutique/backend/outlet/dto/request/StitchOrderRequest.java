package com.sanasboutique.backend.outlet.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.util.List;

/** New order: one or more garments, each with its own delivery date; optional advance. fabricSource: OWN (default) or IN_HOUSE; fabricBillId: optional shop bill of this customer (implies IN_HOUSE). */
public record StitchOrderRequest(
        @NotBlank @Size(max = 150) String customerName,
        @NotBlank @Size(max = 15) String customerMobile,
        @Size(max = 1000) String notes,
        @NotEmpty List<@Valid StitchItemRequest> items,
        @DecimalMin("0") @Digits(integer = 8, fraction = 2) BigDecimal advance,
        String fabricSource,
        Long fabricBillId,
        @Size(max = 150) String authorName) {}
