package com.sanasboutique.backend.catalog.dto.response;

public record ServiceResponse(
        Long id,
        String name,
        String description,
        Long priceUnitId,
        String priceUnitName,
        boolean active,
        long itemCount,
        String bookingMode,
        boolean prebookEnabled,
        String module,
        Long billingModuleId,
        String billingModuleName) {}
