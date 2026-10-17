package com.sanasboutique.backend.outlet.dto.response;

import java.time.LocalDate;
import java.util.List;

public record AvailabilityResponse(boolean available, String reason, List<Conflict> conflicts) {
    public record Conflict(LocalDate from, LocalDate to, String customerName, String status) {}
}
