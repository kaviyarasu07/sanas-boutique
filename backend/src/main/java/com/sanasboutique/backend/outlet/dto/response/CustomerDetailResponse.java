package com.sanasboutique.backend.outlet.dto.response;

import java.math.BigDecimal;
import java.time.Instant;

public record CustomerDetailResponse(
        Long id,
        String name,
        String mobileNumber,
        Instant createdAt,
        long billCount,
        BigDecimal totalSpent,
        Instant lastBillAt) {}
