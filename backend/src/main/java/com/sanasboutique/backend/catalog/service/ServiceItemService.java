package com.sanasboutique.backend.catalog.service;

import com.sanasboutique.backend.catalog.dto.request.ActiveRequest;
import com.sanasboutique.backend.catalog.dto.request.ServiceItemRequest;
import com.sanasboutique.backend.catalog.dto.response.ServiceItemImageResponse;
import com.sanasboutique.backend.catalog.dto.response.ServiceItemResponse;
import com.sanasboutique.backend.catalog.entity.CatalogService;
import com.sanasboutique.backend.catalog.entity.ServiceItem;
import com.sanasboutique.backend.catalog.entity.ServiceItemImage;
import com.sanasboutique.backend.catalog.exception.ResourceNotFoundException;
import com.sanasboutique.backend.catalog.mapper.ServiceItemMapper;
import com.sanasboutique.backend.catalog.repository.ServiceItemImageRepository;
import com.sanasboutique.backend.catalog.repository.ServiceItemRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Service
@Transactional
public class ServiceItemService {
    private static final String ITEM_CODE_PREFIX = "SB-";
    private final ServiceItemRepository repository;
    private final ServiceItemImageRepository images;
    private final CatalogServiceManager services;
    private final com.sanasboutique.backend.catalog.storage.ImageStorageService storage;
    private final ServiceItemMapper mapper;

    public ServiceItemService(
            ServiceItemRepository repository,
            ServiceItemImageRepository images,
            CatalogServiceManager services,
            com.sanasboutique.backend.catalog.storage.ImageStorageService storage,
            ServiceItemMapper mapper) {
        this.repository = repository;
        this.images = images;
        this.services = services;
        this.storage = storage;
        this.mapper = mapper;
    }

    @Transactional(readOnly = true)
    public List<ServiceItemResponse> list(Long serviceId) {
        services.find(serviceId);
        return repository.findByServiceIdOrderByNameAsc(serviceId).stream()
                .map(this::response)
                .toList();
    }

    public ServiceItemResponse create(Long serviceId, ServiceItemRequest request) {
        CatalogService service = services.find(serviceId);
        ServiceItem item =
                repository.save(
                        new ServiceItem(
                                service,
                                request.name().trim(),
                                blankToNull(request.description()),
                                request.price(),
                                request.quantity()));
        item.setItemCode(ITEM_CODE_PREFIX + String.format("%06d", item.getId()));
        return response(repository.save(item));
    }

    /** An outlet adds a product to one of its own services; price and stock belong to that outlet. */
    public ServiceItemResponse createForOutlet(
            Long outletId, Long serviceId, ServiceItemRequest request) {
        CatalogService service = services.find(serviceId);
        ServiceItem item =
                new ServiceItem(
                        service,
                        request.name().trim(),
                        blankToNull(request.description()),
                        request.price(),
                        request.quantity());
        item.setOutletId(outletId);
        item.setReplacementValue(request.replacementValue());
        item = repository.save(item);
        item.setItemCode(ITEM_CODE_PREFIX + String.format("%06d", item.getId()));
        return response(repository.save(item));
    }

    public ServiceItemResponse updateForOutlet(
            Long outletId, Long serviceId, Long id, ServiceItemRequest request) {
        ServiceItem item = findOwned(outletId, serviceId, id);
        item.setName(request.name().trim());
        item.setDescription(blankToNull(request.description()));
        item.setPrice(request.price());
        item.setQuantity(request.quantity());
        item.setReplacementValue(request.replacementValue());
        return response(repository.save(item));
    }

    public ServiceItemResponse setActiveForOutlet(
            Long outletId, Long serviceId, Long id, boolean active) {
        ServiceItem item = findOwned(outletId, serviceId, id);
        item.setActive(active);
        return response(repository.save(item));
    }

    private ServiceItem findOwned(Long outletId, Long serviceId, Long id) {
        ServiceItem item =
                repository
                        .findByIdAndOutletId(id, outletId)
                        .orElseThrow(() -> new ResourceNotFoundException("Item not found"));
        if (!item.getService().getId().equals(serviceId))
            throw new ResourceNotFoundException("Item not found under this service");
        return item;
    }

    public ServiceItemResponse update(Long id, ServiceItemRequest request) {
        ServiceItem item = find(id);
        item.setName(request.name().trim());
        item.setDescription(blankToNull(request.description()));
        item.setPrice(request.price());
        item.setQuantity(request.quantity());
        return response(repository.save(item));
    }

    public ServiceItemResponse setActive(Long id, ActiveRequest request) {
        ServiceItem item = find(id);
        item.setActive(request.active());
        return response(repository.save(item));
    }

    @Transactional(readOnly = true)
    public ServiceItemResponse findByCode(String code) {
        return response(
                repository
                        .findByItemCode(code)
                        .orElseThrow(
                                () -> new ResourceNotFoundException("No item with that code")));
    }

    public ServiceItemImageResponse uploadImage(Long itemId, MultipartFile file) {
        if (file.isEmpty()) throw new IllegalArgumentException("No file was uploaded");
        ServiceItem item = find(itemId);
        String path = storage.store(file, itemId);
        int nextOrder = images.findByItemIdOrderBySortOrderAsc(itemId).size();
        return new ServiceItemImageResponse(
                images.save(new ServiceItemImage(item, path, nextOrder)).getId(), path);
    }

    public void deleteImage(Long itemId, Long imageId) {
        ServiceItemImage image =
                images.findById(imageId)
                        .orElseThrow(() -> new ResourceNotFoundException("Image not found"));
        if (!image.getItem().getId().equals(itemId))
            throw new ResourceNotFoundException("Image not found");
        images.delete(image);
    }

    private ServiceItem find(Long id) {
        return repository
                .findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Item not found"));
    }

    private ServiceItemResponse response(ServiceItem item) {
        return mapper.toResponse(item, images.findByItemIdOrderBySortOrderAsc(item.getId()));
    }

    private static String blankToNull(String value) {
        if (value == null) return null;
        String s = value.trim();
        return s.isEmpty() ? null : s;
    }
}
