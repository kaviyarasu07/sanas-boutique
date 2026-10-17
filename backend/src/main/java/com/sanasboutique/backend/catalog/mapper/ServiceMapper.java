package com.sanasboutique.backend.catalog.mapper;

import com.sanasboutique.backend.catalog.dto.response.ServiceResponse;
import com.sanasboutique.backend.catalog.entity.CatalogService;

import org.springframework.stereotype.Component;

@Component
public class ServiceMapper {
    public ServiceResponse toResponse(CatalogService service, long itemCount) {
        return new ServiceResponse(
                service.getId(),
                service.getName(),
                service.getDescription(),
                service.getPriceUnit().getId(),
                service.getPriceUnit().getName(),
                service.isActive(),
                itemCount,
                service.getBookingMode(),
                service.isPrebookEnabled(),
                service.getModule().name(),
                service.getBillingModule() == null ? null : service.getBillingModule().getId(),
                service.getBillingModule() == null ? null : service.getBillingModule().getName());
    }
}
