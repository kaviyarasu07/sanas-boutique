package com.sanasboutique.backend.outlet.dto.request;

import java.math.BigDecimal;
import java.time.LocalDate;

/** date: hand-over date, return date or completion date (defaults to today). discount: used when billing. */
public record BookingActionRequest(LocalDate date, BigDecimal discount) {}
