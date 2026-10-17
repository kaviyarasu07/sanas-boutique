package com.sanasboutique.backend.outlet.controller;

import com.sanasboutique.backend.outlet.dto.response.*;
import com.sanasboutique.backend.outlet.service.BillService;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/** Read-only cross-outlet billing views for the franchisor. */
@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('FRANCHISOR')")
public class AdminBillController {
    private final BillService service;
    private final com.sanasboutique.backend.outlet.service.AnalyticsService analytics;
    private final com.sanasboutique.backend.outlet.service.ReportService reports;

    public AdminBillController(
            BillService s,
            com.sanasboutique.backend.outlet.service.AnalyticsService a,
            com.sanasboutique.backend.outlet.service.ReportService r) {
        service = s;
        analytics = a;
        reports = r;
    }

    @PostMapping("/reports/sales")
    public SalesReportResponse report(
            @RequestBody com.sanasboutique.backend.outlet.dto.request.ReportRequest request) {
        return reports.sales(null, request);
    }

    @GetMapping("/analytics")
    public SalesAnalyticsResponse analytics() {
        return analytics.forAll();
    }

    @GetMapping("/outlets/{id}/analytics")
    public SalesAnalyticsResponse outletAnalytics(@PathVariable Long id) {
        return analytics.forOutlet(id);
    }

    @GetMapping("/bills")
    public BillPageResponse bills(
            @RequestParam(required = false) Long outletId,
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {
        return service.adminPage(outletId, search, page, from, to);
    }

    @GetMapping("/sales-summary")
    public AdminSalesSummaryResponse summary() {
        return service.adminSummary();
    }

    @GetMapping("/outlets/{id}/dashboard")
    public AdminOutletDashboardResponse outletDashboard(@PathVariable Long id) {
        return service.adminOutletDashboard(id);
    }
}
