package com.sanasboutique.backend.outlet.dto.response;

import java.time.Instant;

/** One booking timeline line: kind CREATED, EDIT, DONE, CANCELLED, RESCHEDULED, AUTO_CANCELLED or COMMENT. */
public record BookingLogResponse(
        Long id, String kind, String message, String authorName, Instant createdAt) {}
