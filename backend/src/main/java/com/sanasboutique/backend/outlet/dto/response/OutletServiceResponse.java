package com.sanasboutique.backend.outlet.dto.response;

public record OutletServiceResponse(
        Long id,
        String name,
        String description,
        Long priceUnitId,
        String priceUnitName,
        boolean active,
        long itemCount,
        boolean allowed,
        String module) {}
