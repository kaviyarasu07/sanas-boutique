package com.sanasboutique.backend.outlet.controller;

import com.sanasboutique.backend.catalog.exception.ResourceNotFoundException;
import com.sanasboutique.backend.outlet.dto.request.BillRequest;
import com.sanasboutique.backend.outlet.dto.response.*;
import com.sanasboutique.backend.outlet.repository.OutletRepository;
import com.sanasboutique.backend.common.OutletModule;
import com.sanasboutique.backend.outlet.service.BillService;
import com.sanasboutique.backend.outlet.service.ModuleAccess;
import com.sanasboutique.backend.security.AuthenticatedUser;

import jakarta.validation.Valid;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/outlet/me/bills")
@PreAuthorize("hasRole('OUTLET')")
public class BillingController {
    private final BillService service;
    private final OutletRepository outlets;
    private final ModuleAccess access;
    private final com.sanasboutique.backend.outlet.service.AnalyticsService analytics;
    private final com.sanasboutique.backend.outlet.service.ReportService reports;

    public BillingController(
            BillService s,
            OutletRepository o,
            ModuleAccess m,
            com.sanasboutique.backend.outlet.service.AnalyticsService a,
            com.sanasboutique.backend.outlet.service.ReportService r) {
        service = s;
        outlets = o;
        access = m;
        analytics = a;
        reports = r;
    }

    @PostMapping("/report")
    public SalesReportResponse report(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestBody com.sanasboutique.backend.outlet.dto.request.ReportRequest request) {
        return reports.sales(outlet(user).getId(), request);
    }

    @GetMapping("/analytics")
    public SalesAnalyticsResponse analytics(@AuthenticationPrincipal AuthenticatedUser user) {
        return analytics.forOutlet(outlet(user).getId());
    }

    /** Shop sales bill (fabric and other products). Only for outlets given a Shop sales service. */
    @PostMapping
    public BillResponse create(
            @AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody BillRequest request) {
        return service.create(access.outletFor(user, OutletModule.SALES), request);
    }

    /** The 10 latest Shop sales bills. */
    @GetMapping("/recent")
    public List<BillResponse> recent(@AuthenticationPrincipal AuthenticatedUser user) {
        return service.recentSales(access.outletFor(user, OutletModule.SALES));
    }

    /** Shop sales bills; each other module lists its own bills on its own screen. */
    @GetMapping
    public BillPageResponse list(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {
        return service.modulePage(access.outletFor(user, OutletModule.SALES), OutletModule.SALES, search, page, from, to);
    }

    @GetMapping("/customers")
    public List<CustomerResponse> customers(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam(defaultValue = "") String mobile) {
        return service.customers(outlet(user).getId(), mobile);
    }

    @GetMapping("/today-total")
    public java.math.BigDecimal todayTotal(@AuthenticationPrincipal AuthenticatedUser user) {
        return service.todayTotal(outlet(user).getId());
    }

    private com.sanasboutique.backend.outlet.entity.Outlet outlet(AuthenticatedUser user) {
        if (user == null || user.franchiseId() == null)
            throw new ResourceNotFoundException("Outlet not found for this login");
        return outlets.findByFranchiseId(user.franchiseId())
                .orElseThrow(
                        () -> new ResourceNotFoundException("Outlet not found for this login"));
    }

    @GetMapping("/customer-list")
    public CustomerPageResponse customerList(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "0") int page) {
        return service.customerPage(outlet(user).getId(), search, page);
    }

    @GetMapping("/customer-list/{id}")
    public CustomerDetailResponse customer(
            @AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long id) {
        return service.customer(outlet(user).getId(), id);
    }

    @GetMapping("/customer-list/{id}/bills")
    public BillPageResponse customerBills(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable Long id,
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "0") int page) {
        return service.customerBills(outlet(user).getId(), id, search, page);
    }
}
