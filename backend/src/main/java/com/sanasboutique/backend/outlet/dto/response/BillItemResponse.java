package com.sanasboutique.backend.outlet.dto.response;

import java.math.BigDecimal;

public record BillItemResponse(
        String itemName,
        String itemCode,
        BigDecimal unitPrice,
        int quantity,
        BigDecimal lineTotal) {}
