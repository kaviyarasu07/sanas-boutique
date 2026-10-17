package com.sanasboutique.backend.outlet.dto.response;

import java.math.BigDecimal;

public record AdminOutletDashboardResponse(
        OutletResponse outlet, BigDecimal todayTotal, long totalBillsToday) {}
