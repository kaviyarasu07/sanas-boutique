package com.sanasboutique.backend.catalog.controller;

import com.sanasboutique.backend.catalog.dto.request.ActiveRequest;
import com.sanasboutique.backend.catalog.dto.request.ServiceRequest;
import com.sanasboutique.backend.catalog.dto.response.ServiceResponse;
import com.sanasboutique.backend.catalog.service.CatalogServiceManager;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
@PreAuthorize("hasRole('FRANCHISOR')")
public class ServiceController {
    private final CatalogServiceManager service;

    public ServiceController(CatalogServiceManager service) {
        this.service = service;
    }

    @GetMapping("/services")
    public List<ServiceResponse> list() {
        return service.list();
    }

    @PostMapping("/services")
    @ResponseStatus(HttpStatus.CREATED)
    public ServiceResponse create(@Valid @RequestBody ServiceRequest request) {
        return service.create(request);
    }

    @PatchMapping("/services/{id}")
    public ServiceResponse update(
            @PathVariable Long id, @Valid @RequestBody ServiceRequest request) {
        return service.update(id, request);
    }

    @PatchMapping("/services/{id}/active")
    public ServiceResponse active(
            @PathVariable Long id, @Valid @RequestBody ActiveRequest request) {
        return service.setActive(id, request);
    }
}
