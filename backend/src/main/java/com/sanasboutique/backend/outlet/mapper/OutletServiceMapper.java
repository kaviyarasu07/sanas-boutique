package com.sanasboutique.backend.outlet.mapper;

import com.sanasboutique.backend.catalog.entity.CatalogService;
import com.sanasboutique.backend.outlet.dto.response.OutletServiceResponse;

import org.springframework.stereotype.Component;

@Component
public class OutletServiceMapper {
    public OutletServiceResponse toResponse(CatalogService s, boolean allowed, long count) {
        return new OutletServiceResponse(
                s.getId(),
                s.getName(),
                s.getDescription(),
                s.getPriceUnit().getId(),
                s.getPriceUnit().getName(),
                s.isActive(),
                count,
                allowed,
                s.getModule().name());
    }
}
