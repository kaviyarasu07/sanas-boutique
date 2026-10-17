package com.sanasboutique.backend.catalog.dto.response;


import java.math.BigDecimal;
import java.util.List;

public record ServiceItemResponse(
        Long id,
        Long serviceId,
        String serviceName,
        String priceUnitName,
        String name,
        String description,
        String itemCode,
        BigDecimal price,
        Integer quantity,
        boolean active,
        List<ServiceItemImageResponse> images) {}
