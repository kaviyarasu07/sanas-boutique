package com.sanasboutique.backend.outlet.controller;

import com.sanasboutique.backend.catalog.dto.request.ServiceItemRequest;
import com.sanasboutique.backend.catalog.dto.response.ServiceItemResponse;
import com.sanasboutique.backend.catalog.exception.ResourceNotFoundException;
import com.sanasboutique.backend.outlet.dto.response.OutletResponse;
import com.sanasboutique.backend.outlet.dto.response.OutletServiceItemResponse;
import com.sanasboutique.backend.outlet.dto.response.OutletServiceResponse;
import com.sanasboutique.backend.outlet.mapper.OutletMapper;
import com.sanasboutique.backend.outlet.repository.OutletRepository;
import com.sanasboutique.backend.outlet.service.OutletServiceAssignmentService;
import com.sanasboutique.backend.security.AuthenticatedUser;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Endpoints scoped to the outlet represented by the current login. */
@RestController
@RequestMapping("/api/outlet/me")
@PreAuthorize("hasRole('OUTLET')")
public class OutletSelfController {
    private final OutletRepository outlets;
    private final OutletMapper mapper;
    private final OutletServiceAssignmentService assignments;
    private final com.sanasboutique.backend.outlet.service.OutletService outletService;
    private final com.sanasboutique.backend.outlet.service.ModuleAccess moduleAccess;

    public OutletSelfController(
            OutletRepository outlets,
            OutletMapper mapper,
            OutletServiceAssignmentService assignments,
            com.sanasboutique.backend.outlet.service.OutletService outletService,
            com.sanasboutique.backend.outlet.service.ModuleAccess moduleAccess) {
        this.outletService = outletService;
        this.outlets = outlets;
        this.mapper = mapper;
        this.assignments = assignments;
        this.moduleAccess = moduleAccess;
    }

    @GetMapping
    public OutletResponse outlet(@AuthenticationPrincipal AuthenticatedUser user) {
        return mapper.toResponse(findOutlet(user));
    }

    /** Modules this outlet may use: those of the services the franchisor gave it (drives the outlet menu). */
    @GetMapping("/modules")
    public java.util.List<String> modules(@AuthenticationPrincipal AuthenticatedUser user) {
        return moduleAccess.modules(moduleAccess.outletOf(user)).stream().map(Enum::name).toList();
    }

    @PatchMapping
    public OutletResponse updateProfile(
            @AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody
                    com.sanasboutique.backend.outlet.dto.request.OutletProfileRequest request) {
        var o = findOutlet(user);
        return outletService.update(
                o.getId(),
                new com.sanasboutique.backend.outlet.dto.request.OutletRequest(
                        o.getName(),
                        request.ownerName(),
                        request.address(),
                        o.getMobileNumber(),
                        request.email(),
                        null));
    }

    @GetMapping("/services")
    public List<OutletServiceResponse> services(@AuthenticationPrincipal AuthenticatedUser user) {
        return assignments.services(findOutlet(user).getId()).stream()
                .filter(OutletServiceResponse::allowed)
                .toList();
    }

    @GetMapping("/items")
    public List<OutletServiceItemResponse> items(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam(defaultValue = "") String search) {
        return assignments.searchItems(findOutlet(user).getId(), search);
    }

    /** Scan / price check. Never cached, so the price shown is always the current one. */
    @GetMapping("/items/by-code")
    public org.springframework.http.ResponseEntity<OutletServiceItemResponse> itemByCode(
            @AuthenticationPrincipal AuthenticatedUser user, @RequestParam String code) {
        return org.springframework.http.ResponseEntity.ok()
                .cacheControl(org.springframework.http.CacheControl.noStore())
                .body(assignments.findItemByCode(findOutlet(user).getId(), code));
    }

    @GetMapping("/services/{serviceId}/items")
    public org.springframework.data.domain.Page<OutletServiceItemResponse> serviceItems(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable Long serviceId,
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return assignments.items(
                findOutlet(user).getId(), serviceId, search, page, Math.min(size, 50));
    }

    @PostMapping("/services/{serviceId}/items")
    @ResponseStatus(HttpStatus.CREATED)
    public ServiceItemResponse createItem(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable Long serviceId,
            @Valid @RequestBody ServiceItemRequest request) {
        return assignments.createItem(findOutlet(user).getId(), serviceId, request);
    }

    @PatchMapping("/services/{serviceId}/items/{itemId}")
    public ServiceItemResponse updateItem(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable Long serviceId,
            @PathVariable Long itemId,
            @Valid @RequestBody ServiceItemRequest request) {
        return assignments.updateItem(findOutlet(user).getId(), serviceId, itemId, request);
    }

    @PatchMapping("/services/{serviceId}/items/{itemId}/active")
    public ServiceItemResponse setItemActive(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable Long serviceId,
            @PathVariable Long itemId,
            @Valid @RequestBody
                    com.sanasboutique.backend.catalog.dto.request.ActiveRequest request) {
        return assignments.setItemActive(
                findOutlet(user).getId(), serviceId, itemId, request.active());
    }

    private com.sanasboutique.backend.outlet.entity.Outlet findOutlet(AuthenticatedUser user) {
        if (user == null || user.franchiseId() == null) {
            throw new ResourceNotFoundException("Outlet not found for this login");
        }
        return outlets.findByFranchiseId(user.franchiseId())
                .orElseThrow(
                        () -> new ResourceNotFoundException("Outlet not found for this login"));
    }
}
