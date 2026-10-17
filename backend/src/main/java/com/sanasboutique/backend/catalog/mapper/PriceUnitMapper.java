package com.sanasboutique.backend.catalog.mapper;

import com.sanasboutique.backend.catalog.dto.response.PriceUnitResponse;
import com.sanasboutique.backend.catalog.entity.PriceUnit;

import org.springframework.stereotype.Component;

@Component
public class PriceUnitMapper {
    public PriceUnitResponse toResponse(PriceUnit unit) {
        return new PriceUnitResponse(unit.getId(), unit.getName());
    }
}
