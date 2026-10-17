package com.sanasboutique.backend.outlet.dto.response;

import java.math.BigDecimal;
import java.time.Instant;

/** A shop bill of the customer that can be linked as "fabric bought here". */
public record StitchFabricBillResponse(
        Long id, String billNumber, BigDecimal total, String summary, Instant createdAt) {}
