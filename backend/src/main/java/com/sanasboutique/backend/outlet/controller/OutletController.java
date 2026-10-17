package com.sanasboutique.backend.outlet.controller;

import com.sanasboutique.backend.catalog.dto.request.ActiveRequest;
import com.sanasboutique.backend.outlet.dto.request.OutletRequest;
import com.sanasboutique.backend.outlet.dto.response.*;
import com.sanasboutique.backend.outlet.service.OutletService;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/outlets")
@PreAuthorize("hasRole('FRANCHISOR')")
public class OutletController {
    private final OutletService service;

    public OutletController(OutletService service) {
        this.service = service;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public OutletCreatedResponse create(@Valid @RequestBody OutletRequest r) {
        return service.create(r);
    }

    @GetMapping
    public List<OutletResponse> list() {
        return service.list();
    }

    @GetMapping("/{id}")
    public OutletResponse get(@PathVariable Long id) {
        return service.get(id);
    }

    @PatchMapping("/{id}")
    public OutletResponse update(@PathVariable Long id, @Valid @RequestBody OutletRequest r) {
        return service.update(id, r);
    }

    @PatchMapping("/{id}/active")
    public OutletResponse active(@PathVariable Long id, @Valid @RequestBody ActiveRequest r) {
        return service.setActive(id, r.active());
    }

    @PostMapping("/{id}/regenerate-password")
    public OutletCreatedResponse regenerate(@PathVariable Long id) {
        return service.regeneratePassword(id);
    }
}
