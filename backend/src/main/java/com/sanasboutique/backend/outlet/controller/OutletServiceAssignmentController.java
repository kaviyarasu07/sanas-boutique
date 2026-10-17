package com.sanasboutique.backend.outlet.controller;

import com.sanasboutique.backend.outlet.dto.request.*;
import com.sanasboutique.backend.outlet.dto.response.*;
import com.sanasboutique.backend.outlet.service.OutletServiceAssignmentService;

import jakarta.validation.Valid;

import org.springframework.data.domain.Page;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/outlets/{outletId}")
@PreAuthorize("hasRole('FRANCHISOR')")
public class OutletServiceAssignmentController {
    private final OutletServiceAssignmentService service;

    public OutletServiceAssignmentController(OutletServiceAssignmentService service) {
        this.service = service;
    }

    @GetMapping("/services")
    public List<OutletServiceResponse> services(@PathVariable Long outletId) {
        return service.services(outletId);
    }

    @PatchMapping("/services/{serviceId}")
    public OutletServiceResponse toggleService(
            @PathVariable Long outletId,
            @PathVariable Long serviceId,
            @Valid @RequestBody OutletServiceToggleRequest r) {
        return service.toggleService(outletId, serviceId, r);
    }

    @GetMapping("/services/{serviceId}/items")
    public Page<OutletServiceItemResponse> items(
            @PathVariable Long outletId,
            @PathVariable Long serviceId,
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return service.items(outletId, serviceId, search, page, size);
    }
}
