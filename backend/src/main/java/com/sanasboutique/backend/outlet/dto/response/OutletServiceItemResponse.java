package com.sanasboutique.backend.outlet.dto.response;

import java.math.BigDecimal;

public record OutletServiceItemResponse(
        Long id,
        Long serviceId,
        String serviceName,
        String priceUnitName,
        String name,
        String description,
        String itemCode,
        BigDecimal price,
        Integer parentQuantity,
        boolean active,
        boolean allowed,
        Integer allocatedQuantity,
        String bookingMode,
        String module,
        BigDecimal replacementValue,
        Long billingModuleId,
        String billingModuleName) {}
