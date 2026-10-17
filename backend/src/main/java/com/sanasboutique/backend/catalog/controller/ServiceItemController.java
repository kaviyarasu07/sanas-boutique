package com.sanasboutique.backend.catalog.controller;

import com.sanasboutique.backend.catalog.dto.response.ServiceItemResponse;
import com.sanasboutique.backend.catalog.service.ServiceItemService;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Products belong to outlets and are managed by the outlet itself
 * (/api/outlet/me/...). The admin controls services only and can look a product
 * up read-only; per-outlet product lists are under /api/outlets/{id}/services/{id}/items.
 */
@RestController
@RequestMapping("/api")
@PreAuthorize("hasRole('FRANCHISOR')")
public class ServiceItemController {
    private final ServiceItemService service;

    public ServiceItemController(ServiceItemService service) {
        this.service = service;
    }

    @GetMapping("/service-items/by-code/{itemCode}")
    public ServiceItemResponse findByCode(@PathVariable String itemCode) {
        return service.findByCode(itemCode);
    }
}
