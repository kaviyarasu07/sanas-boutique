package com.sanasboutique.backend.outlet.dto.response;

import java.math.BigDecimal;
import java.util.List;

public record AdminSalesSummaryResponse(
        BigDecimal todayTotal,
        long todayBills,
        BigDecimal monthTotal,
        long totalOutlets,
        long activeOutlets,
        List<OutletSales> outlets) {
    public record OutletSales(
            Long outletId,
            String name,
            boolean active,
            BigDecimal todayTotal,
            BigDecimal monthTotal) {}
}
