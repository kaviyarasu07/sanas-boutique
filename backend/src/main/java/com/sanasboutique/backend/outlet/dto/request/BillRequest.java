package com.sanasboutique.backend.outlet.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.util.List;

public record BillRequest(
        @NotBlank @Size(max = 150) String customerName,
        @NotBlank @Size(max = 15) String customerMobile,
        @NotNull @DecimalMin("0") BigDecimal discount,
        List<@Valid BillLineRequest> items) {}
