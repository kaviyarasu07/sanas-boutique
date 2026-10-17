package com.sanasboutique.backend.catalog.mapper;

import com.sanasboutique.backend.catalog.dto.response.ServiceItemImageResponse;
import com.sanasboutique.backend.catalog.dto.response.ServiceItemResponse;
import com.sanasboutique.backend.catalog.entity.ServiceItem;
import com.sanasboutique.backend.catalog.entity.ServiceItemImage;

import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class ServiceItemMapper {
    public ServiceItemResponse toResponse(ServiceItem item, List<ServiceItemImage> images) {
        var service = item.getService();
        return new ServiceItemResponse(
                item.getId(),
                service.getId(),
                service.getName(),
                service.getPriceUnit().getName(),
                item.getName(),
                item.getDescription(),
                item.getItemCode(),
                item.getPrice(),
                item.getQuantity(),
                item.isActive(),
                images.stream().map(this::toImageResponse).toList());
    }

    private ServiceItemImageResponse toImageResponse(ServiceItemImage image) {
        return new ServiceItemImageResponse(image.getId(), image.getImageUrl());
    }
}
