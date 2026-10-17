package com.sanasboutique.backend.catalog.controller;

import com.sanasboutique.backend.catalog.dto.request.ActiveRequest;
import com.sanasboutique.backend.catalog.dto.request.BillingModuleRequest;
import com.sanasboutique.backend.catalog.dto.response.BillingModuleResponse;
import com.sanasboutique.backend.catalog.service.BillingModuleService;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** Franchisor: create and manage simple billing modules (docs/features/custom-billing-modules.md). */
@RestController
@RequestMapping("/api/billing-modules")
@PreAuthorize("hasRole('FRANCHISOR')")
public class BillingModuleController {
    private final BillingModuleService service;

    public BillingModuleController(BillingModuleService service) {
        this.service = service;
    }

    @GetMapping
    public List<BillingModuleResponse> list() {
        return service.list();
    }

    /** The bill code a module with this name would get. */
    @GetMapping("/code-preview")
    public Map<String, String> previewCode(@RequestParam(defaultValue = "") String name) {
        return Map.of("code", service.previewCode(name));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public BillingModuleResponse create(@Valid @RequestBody BillingModuleRequest request) {
        return service.create(request);
    }

    @PutMapping("/{id}")
    public BillingModuleResponse update(@PathVariable Long id, @Valid @RequestBody BillingModuleRequest request) {
        return service.update(id, request);
    }

    @PatchMapping("/{id}/active")
    public BillingModuleResponse setActive(@PathVariable Long id, @Valid @RequestBody ActiveRequest request) {
        return service.setActive(id, request.active());
    }
}
