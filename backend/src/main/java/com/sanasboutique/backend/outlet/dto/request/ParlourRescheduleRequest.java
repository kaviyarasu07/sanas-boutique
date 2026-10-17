package com.sanasboutique.backend.outlet.dto.request;

import jakarta.validation.constraints.*;

import java.time.LocalDate;
import java.time.LocalTime;

/** "Cancel & reschedule": the new day and time; the same services are booked again. */
public record ParlourRescheduleRequest(
        @NotNull LocalDate date, @NotNull LocalTime time, @Size(max = 150) String authorName) {}
