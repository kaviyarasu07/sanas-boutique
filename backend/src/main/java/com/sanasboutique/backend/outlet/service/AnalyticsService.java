package com.sanasboutique.backend.outlet.service;

import com.sanasboutique.backend.catalog.exception.ResourceNotFoundException;
import com.sanasboutique.backend.outlet.dto.response.SalesAnalyticsResponse;
import com.sanasboutique.backend.outlet.dto.response.SalesAnalyticsResponse.*;
import com.sanasboutique.backend.outlet.repository.*;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.*;
import java.util.List;

/** Today / this-month sales, top service and top outlet (IST calendar days and months). */
@Service
@Transactional(readOnly = true)
public class AnalyticsService {
    private static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");
    private final BillRepository bills;
    private final BillItemRepository billItems;
    private final OutletRepository outlets;

    public AnalyticsService(BillRepository b, BillItemRepository bi, OutletRepository o) {
        bills = b;
        billItems = bi;
        outlets = o;
    }

    /** All outlets together, plus the outlet ranking. */
    public SalesAnalyticsResponse forAll() {
        Instant[] t = today(), m = month();
        return new SalesAnalyticsResponse(period(null, t), period(null, m), ranking(t), ranking(m));
    }

    /** One outlet; the ranking lists are empty. */
    public SalesAnalyticsResponse forOutlet(Long outletId) {
        outlets.findById(outletId)
                .orElseThrow(() -> new ResourceNotFoundException("Outlet not found"));
        return new SalesAnalyticsResponse(
                period(outletId, today()), period(outletId, month()), List.of(), List.of());
    }

    private PeriodSales period(Long outletId, Instant[] r) {
        BigDecimal total =
                outletId == null
                        ? bills.sumForAll(r[0], r[1])
                        : bills.sumForOutlet(outletId, r[0], r[1]);
        long count =
                outletId == null
                        ? bills.countForAll(r[0], r[1])
                        : bills.countForOutlet(outletId, r[0], r[1]);
        List<ServiceSales> services =
                (outletId == null
                                ? billItems.serviceSalesForAll(r[0], r[1])
                                : billItems.serviceSalesForOutlet(outletId, r[0], r[1]))
                        .stream()
                                .map(
                                        x ->
                                                new ServiceSales(
                                                        (Long) x[0],
                                                        (String) x[1],
                                                        (BigDecimal) x[2],
                                                        ((Number) x[3]).longValue()))
                                .toList();
        return new PeriodSales(total, count, services.isEmpty() ? null : services.get(0), services);
    }

    private List<OutletRank> ranking(Instant[] r) {
        return bills.outletRanking(r[0], r[1]).stream()
                .map(
                        x ->
                                new OutletRank(
                                        (Long) x[0], (String) x[1], (BigDecimal) x[2], (Long) x[3]))
                .toList();
    }

    private static Instant[] today() {
        LocalDate d = LocalDate.now(ZONE);
        return new Instant[] {
            d.atStartOfDay(ZONE).toInstant(), d.plusDays(1).atStartOfDay(ZONE).toInstant()
        };
    }

    private static Instant[] month() {
        LocalDate d = LocalDate.now(ZONE);
        return new Instant[] {
            d.withDayOfMonth(1).atStartOfDay(ZONE).toInstant(),
            d.plusDays(1).atStartOfDay(ZONE).toInstant()
        };
    }
}
