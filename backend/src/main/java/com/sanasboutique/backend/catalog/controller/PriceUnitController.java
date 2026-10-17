package com.sanasboutique.backend.catalog.controller;

import com.sanasboutique.backend.catalog.dto.request.PriceUnitRequest;
import com.sanasboutique.backend.catalog.dto.response.PriceUnitResponse;
import com.sanasboutique.backend.catalog.service.PriceUnitService;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
@PreAuthorize("hasRole('FRANCHISOR')")
public class PriceUnitController {
    private final PriceUnitService service;

    public PriceUnitController(PriceUnitService service) {
        this.service = service;
    }

    @GetMapping("/price-units")
    public List<PriceUnitResponse> list() {
        return service.list();
    }

    @PostMapping("/price-units")
    @ResponseStatus(HttpStatus.CREATED)
    public PriceUnitResponse create(@Valid @RequestBody PriceUnitRequest request) {
        return service.create(request);
    }
}
