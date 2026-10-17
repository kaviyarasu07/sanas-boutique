package com.sanasboutique.backend.outlet.mapper;

import com.sanasboutique.backend.catalog.entity.ServiceItem;
import com.sanasboutique.backend.outlet.dto.response.OutletServiceItemResponse;

import org.springframework.stereotype.Component;

@Component
public class OutletServiceItemMapper {
    public OutletServiceItemResponse toResponse(ServiceItem i, boolean allowed, Integer allocated) {
        return new OutletServiceItemResponse(
                i.getId(),
                i.getService().getId(),
                i.getService().getName(),
                i.getService().getPriceUnit().getName(),
                i.getName(),
                i.getDescription(),
                i.getItemCode(),
                i.getPrice(),
                i.getQuantity(),
                i.isActive(),
                allowed,
                allocated,
                com.sanasboutique.backend.outlet.service.BookingModes.effective(i),
                i.getService().getModule().name(),
                i.getReplacementValue(),
                i.getService().getBillingModule() == null ? null : i.getService().getBillingModule().getId(),
                i.getService().getBillingModule() == null ? null : i.getService().getBillingModule().getName());
    }
}
