package com.sanasboutique.backend.outlet.dto.request;

import jakarta.validation.constraints.NotNull;

import java.time.*;

public record RescheduleRequest(
        @NotNull LocalDate startDate, LocalTime startTime, LocalDate expectedReturnDate) {}
