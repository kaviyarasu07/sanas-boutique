package com.sanasboutique.backend.outlet.service;

import com.sanasboutique.backend.outlet.dto.request.ReportRequest;
import com.sanasboutique.backend.outlet.dto.response.SalesReportResponse;
import com.sanasboutique.backend.outlet.dto.response.SalesReportResponse.*;
import com.sanasboutique.backend.outlet.repository.BillItemRepository;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.*;
import java.util.*;

@Service
@Transactional(readOnly = true)
public class ReportService {
    static final int MAX_ROWS = 20000;
    private static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");
    private final BillItemRepository billItems;

    public ReportService(BillItemRepository b) {
        billItems = b;
    }

    /** outletScope: the outlet to restrict to (outlet users), or null to honour the request's outletIds (admin). */
    public SalesReportResponse sales(Long outletScope, ReportRequest r) {
        List<Long> outletIds = outletScope != null ? List.of(outletScope) : clean(r.outletIds()),
                serviceIds = clean(r.serviceIds());
        LocalDate from = date(r.from(), "from"), to = date(r.to(), "to");
        if (from != null && to != null && to.isBefore(from))
            throw new IllegalArgumentException("'To' date cannot be before 'From' date");
        Instant start = from == null ? Instant.EPOCH : from.atStartOfDay(ZONE).toInstant(),
                end =
                        to == null
                                ? Instant.parse("9999-01-01T00:00:00Z")
                                : to.plusDays(1).atStartOfDay(ZONE).toInstant();
        List<Object[]> raw =
                billItems.reportRows(
                        start,
                        end,
                        outletIds.isEmpty(),
                        outletIds.isEmpty() ? List.of(-1L) : outletIds,
                        serviceIds.isEmpty(),
                        serviceIds.isEmpty() ? List.of(-1L) : serviceIds,
                        PageRequest.of(0, MAX_ROWS + 1));
        if (raw.size() > MAX_ROWS)
            throw new IllegalArgumentException(
                    "Report has more than "
                            + MAX_ROWS
                            + " lines. Narrow the date range, outlets or services.");
        List<Row> rows = new ArrayList<>();
        Set<Long> billIds = new HashSet<>();
        Map<String, BigDecimal> svc = new LinkedHashMap<>(), out = new LinkedHashMap<>();
        Map<String, Long> outUnits = new HashMap<>(), svcUnits = new HashMap<>();
        BigDecimal total = BigDecimal.ZERO;
        long unitTotal = 0;
        for (Object[] x : raw) {
            int q = ((Number) x[9]).intValue();
            BigDecimal line = (BigDecimal) x[11];
            String outlet = (String) x[2], service = (String) x[6];
            rows.add(
                    new Row(
                            (Instant) x[0],
                            (String) x[1],
                            outlet,
                            (String) x[3],
                            (String) x[4],
                            service,
                            (String) x[7],
                            (String) x[8],
                            q,
                            (BigDecimal) x[10],
                            line));
            billIds.add((Long) x[12]);
            total = total.add(line);
            unitTotal += q;
            svc.merge(service, line, BigDecimal::add);
            out.merge(outlet, line, BigDecimal::add);
            svcUnits.merge(service, (long) q, Long::sum);
            outUnits.merge(outlet, (long) q, Long::sum);
        }
        return new SalesReportResponse(
                Instant.now(),
                r.from(),
                r.to(),
                billIds.size(),
                unitTotal,
                total,
                groups(svc, svcUnits),
                groups(out, outUnits),
                rows);
    }

    private static List<Group> groups(Map<String, BigDecimal> sales, Map<String, Long> units) {
        return sales.entrySet().stream()
                .sorted((a, b) -> b.getValue().compareTo(a.getValue()))
                .map(e -> new Group(e.getKey(), units.get(e.getKey()), e.getValue()))
                .toList();
    }

    private static List<Long> clean(List<Long> ids) {
        return ids == null ? List.of() : ids.stream().filter(Objects::nonNull).distinct().toList();
    }

    private static LocalDate date(String v, String name) {
        if (v == null || v.isBlank()) return null;
        try {
            return LocalDate.parse(v.trim());
        } catch (java.time.format.DateTimeParseException e) {
            throw new IllegalArgumentException("Invalid '" + name + "' date, expected yyyy-MM-dd");
        }
    }
}
