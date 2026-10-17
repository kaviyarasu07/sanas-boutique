package com.sanasboutique.backend.outlet.dto.response;

import java.math.BigDecimal;
import java.util.List;

/** Sales figures for one outlet or (in the admin view) all outlets, for today and the current month. */
public record SalesAnalyticsResponse(
        PeriodSales today,
        PeriodSales month,
        List<OutletRank> topOutletsToday,
        List<OutletRank> topOutletsMonth) {
    public record PeriodSales(
            BigDecimal total, long bills, ServiceSales topService, List<ServiceSales> services) {}

    public record ServiceSales(Long serviceId, String name, BigDecimal sales, long units) {}

    public record OutletRank(Long outletId, String name, BigDecimal sales, long bills) {}
}
