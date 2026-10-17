package com.sanasboutique.backend.outlet.controller;

import com.sanasboutique.backend.outlet.dto.request.BillRequest;
import com.sanasboutique.backend.outlet.dto.response.*;
import com.sanasboutique.backend.outlet.service.BillService;
import com.sanasboutique.backend.outlet.service.BillingModuleSales;
import com.sanasboutique.backend.outlet.service.ModuleAccess;
import com.sanasboutique.backend.security.AuthenticatedUser;

import jakarta.validation.Valid;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Franchisor-created billing modules at the signed-in outlet (docs/features/custom-billing-modules.md).
 * Outlet from the JWT; every call checks centrally that the outlet was given the module (403 otherwise).
 */
@RestController
@RequestMapping("/api/outlet/me/billing-modules")
@PreAuthorize("hasRole('OUTLET')")
public class OutletBillingModuleController {
    private final ModuleAccess access;
    private final BillingModuleSales sales;
    private final BillService bills;

    public OutletBillingModuleController(ModuleAccess access, BillingModuleSales sales, BillService bills) {
        this.access = access;
        this.sales = sales;
        this.bills = bills;
    }

    public record OutletBillingModule(Long id, String name, String code, String icon) {}

    /** The billing modules this outlet may use (drives the menu, with GET /outlet/me/modules). */
    @GetMapping
    public List<OutletBillingModule> list(@AuthenticationPrincipal AuthenticatedUser user) {
        return access.billingModules(access.outletOf(user)).stream()
                .map(m -> new OutletBillingModule(m.getId(), m.getName(), m.getCode(), m.getIcon()))
                .toList();
    }

    @GetMapping("/{id}/items")
    public List<OutletServiceItemResponse> items(
            @AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long id, @RequestParam(defaultValue = "") String search) {
        ModuleAccess.BillingAccess a = access.billingModuleFor(user, id);
        return sales.items(a.outletId(), id, search);
    }

    @PostMapping("/{id}/bills")
    public BillResponse bill(
            @AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long id, @Valid @RequestBody BillRequest request) {
        ModuleAccess.BillingAccess a = access.billingModuleFor(user, id);
        return bills.createInBillingModule(a.outletId(), a.module(), request);
    }

    @GetMapping("/{id}/bills")
    public BillPageResponse list(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable Long id,
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {
        ModuleAccess.BillingAccess a = access.billingModuleFor(user, id);
        return bills.billingModulePage(a.outletId(), id, search, page, from, to);
    }

    @GetMapping("/{id}/bills/recent")
    public List<BillResponse> recent(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long id) {
        ModuleAccess.BillingAccess a = access.billingModuleFor(user, id);
        return bills.recentInBillingModule(a.outletId(), id);
    }
}
