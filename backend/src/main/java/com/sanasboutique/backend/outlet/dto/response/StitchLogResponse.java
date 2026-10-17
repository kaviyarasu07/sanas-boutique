package com.sanasboutique.backend.outlet.dto.response;

import java.time.Instant;

/** One timeline line: kind CREATED, STATUS, EDIT, ADVANCE, DATE, DELIVERED, CANCELLED, REFUND or COMMENT. */
public record StitchLogResponse(
        Long id, String kind, String message, String garment, String authorName, Instant createdAt) {}
