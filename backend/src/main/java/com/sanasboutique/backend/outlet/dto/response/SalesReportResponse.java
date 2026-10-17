package com.sanasboutique.backend.outlet.dto.response;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** Line-level sales report. totalSales is the sum of item line totals (before bill-level discounts). */
public record SalesReportResponse(
        Instant generatedAt,
        String from,
        String to,
        long billCount,
        long units,
        BigDecimal totalSales,
        List<Group> byService,
        List<Group> byOutlet,
        List<Row> rows) {
    public record Group(String name, long units, BigDecimal sales) {}

    public record Row(
            Instant createdAt,
            String billNumber,
            String outlet,
            String customerName,
            String customerMobile,
            String service,
            String item,
            String itemCode,
            int quantity,
            BigDecimal unitPrice,
            BigDecimal lineTotal) {}
}
