package com.sanasboutique.backend.outlet.service;

import com.sanasboutique.backend.catalog.exception.ResourceNotFoundException;
import com.sanasboutique.backend.common.OutletModule;
import com.sanasboutique.backend.outlet.repository.OutletRepository;
import com.sanasboutique.backend.outlet.repository.OutletServiceRepository;
import com.sanasboutique.backend.security.AuthenticatedUser;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.sanasboutique.backend.catalog.entity.BillingModule;

import java.util.*;

/**
 * The one place that decides which modules an outlet may use (docs/features/outlet-modules.md).
 * An outlet can use a module when the franchisor has given it at least one active service of that
 * module. Module controllers resolve the caller's outlet through here (outlet from the JWT, never
 * from the request), so the menu and the API always agree. Per-staff module access (FRONT_DESK)
 * can be added here later without touching the controllers.
 */
@Component
public class ModuleAccess {
    private final OutletRepository outlets;
    private final OutletServiceRepository assignments;

    public ModuleAccess(OutletRepository outlets, OutletServiceRepository assignments) {
        this.outlets = outlets;
        this.assignments = assignments;
    }

    /** Built-in modules of the services given to this outlet (active assignment, active service). */
    @Transactional(readOnly = true)
    public Set<OutletModule> modules(Long outletId) {
        Set<OutletModule> out = EnumSet.noneOf(OutletModule.class);
        assignments.findByOutletId(outletId).stream()
                .filter(a -> a.isActive() && a.getService().isActive())
                .map(a -> a.getService().getModule())
                .filter(m -> m != OutletModule.CUSTOM)
                .forEach(out::add);
        return out;
    }

    /** Franchisor-created billing modules (switched on) of the services given to this outlet, by name. */
    @Transactional(readOnly = true)
    public List<BillingModule> billingModules(Long outletId) {
        Map<Long, BillingModule> out = new TreeMap<>();
        assignments.findByOutletId(outletId).stream()
                .filter(a -> a.isActive() && a.getService().isActive())
                .map(a -> a.getService().getBillingModule())
                .filter(m -> m != null && m.isActive())
                .forEach(m -> out.putIfAbsent(m.getId(), m));
        return out.values().stream().sorted(Comparator.comparing(BillingModule::getName, String.CASE_INSENSITIVE_ORDER)).toList();
    }

    /** The caller's outlet and the billing module, refused with 403 when the outlet was not given it (or it is switched off). */
    @Transactional(readOnly = true)
    public BillingAccess billingModuleFor(AuthenticatedUser user, Long billingModuleId) {
        Long outletId = outletOf(user);
        BillingModule m = billingModules(outletId).stream().filter(x -> x.getId().equals(billingModuleId)).findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "This billing module is not enabled for this outlet"));
        return new BillingAccess(outletId, m);
    }

    public record BillingAccess(Long outletId, BillingModule module) {}

    /** The caller's outlet, refused with 403 when the franchisor has not given it this module. */
    @Transactional(readOnly = true)
    public Long outletFor(AuthenticatedUser user, OutletModule module) {
        Long outletId = outletOf(user);
        if (!modules(outletId).contains(module))
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN, name(module) + " is not enabled for this outlet");
        return outletId;
    }

    private static String name(OutletModule m) {
        return switch (m) {
            case RENTAL -> "Jewellery rental";
            case PARLOUR -> "Parlour";
            case STITCHING -> "Stitching";
            case SALES -> "Shop sales";
            case CUSTOM -> "This billing module";
        };
    }

    /** The caller's outlet (from the JWT). */
    @Transactional(readOnly = true)
    public Long outletOf(AuthenticatedUser user) {
        if (user == null || user.franchiseId() == null)
            throw new ResourceNotFoundException("Outlet not found for this login");
        return outlets.findByFranchiseId(user.franchiseId())
                .map(o -> o.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Outlet not found for this login"));
    }
}
