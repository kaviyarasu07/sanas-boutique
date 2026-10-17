package com.sanasboutique.backend.outlet.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.util.List;

/**
 * A parlour bill. Walk-in: customer + services. Booked customer arrived: bookingId (today's
 * appointment); the lines are what was actually done (services may be added or removed), and the
 * booking's customer is used. Prices are fixed; only a discount can be given.
 */
public record ParlourBillRequest(
        @Size(max = 150) String customerName,
        @Size(max = 15) String customerMobile,
        @NotEmpty List<@Valid ParlourLine> lines,
        @DecimalMin("0") @Digits(integer = 8, fraction = 2) BigDecimal discount,
        Long bookingId,
        @Size(max = 150) String authorName) {}
