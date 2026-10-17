package com.sanasboutique.backend.outlet.dto.response;

import java.util.List;

/** The module dashboard: pre-bookings to hand over today, rentals due back today, late rentals, pieces under repair. */
public record RentalDashboardResponse(
        List<RentalBookingResponse> toCollect,
        List<RentalBookingResponse> dueBack,
        List<RentalBookingResponse> late,
        long underRepair) {}
