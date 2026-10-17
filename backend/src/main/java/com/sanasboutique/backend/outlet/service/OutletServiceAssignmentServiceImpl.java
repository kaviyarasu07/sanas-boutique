package com.sanasboutique.backend.outlet.service;

import com.sanasboutique.backend.catalog.dto.request.ServiceItemRequest;
import com.sanasboutique.backend.catalog.dto.response.ServiceItemResponse;
import com.sanasboutique.backend.catalog.entity.*;
import com.sanasboutique.backend.catalog.exception.ResourceNotFoundException;
import com.sanasboutique.backend.catalog.repository.*;
import com.sanasboutique.backend.outlet.dto.request.*;
import com.sanasboutique.backend.outlet.dto.response.*;
import com.sanasboutique.backend.outlet.entity.*;
import com.sanasboutique.backend.outlet.mapper.*;
import com.sanasboutique.backend.outlet.repository.*;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
@Transactional
public class OutletServiceAssignmentServiceImpl implements OutletServiceAssignmentService {
    private final OutletRepository outlets;
    private final OutletServiceRepository assignments;
    private final OutletServiceItemRepository itemAssignments;
    private final CatalogServiceRepository services;
    private final ServiceItemRepository items;
    private final OutletServiceMapper serviceMapper;
    private final OutletServiceItemMapper itemMapper;
    private final com.sanasboutique.backend.catalog.service.ServiceItemService itemService;

    public OutletServiceAssignmentServiceImpl(
            OutletRepository o,
            OutletServiceRepository a,
            OutletServiceItemRepository ia,
            CatalogServiceRepository s,
            ServiceItemRepository i,
            OutletServiceMapper sm,
            OutletServiceItemMapper im,
            com.sanasboutique.backend.catalog.service.ServiceItemService itemService) {
        outlets = o;
        assignments = a;
        itemAssignments = ia;
        services = s;
        items = i;
        serviceMapper = sm;
        itemMapper = im;
        this.itemService = itemService;
    }

    @Transactional(readOnly = true)
    public List<OutletServiceResponse> services(Long outletId) {
        Outlet o = outlet(outletId);
        Map<Long, com.sanasboutique.backend.outlet.entity.OutletService> map = new HashMap<>();
        assignments.findByOutletId(o.getId()).forEach(a -> map.put(a.getService().getId(), a));
        return services.findAll().stream()
                .map(
                        s -> {
                            com.sanasboutique.backend.outlet.entity.OutletService a =
                                    map.get(s.getId());
                            return serviceMapper.toResponse(
                                    s,
                                    a != null && a.isActive(),
                                    items.countByOutletIdAndServiceId(o.getId(), s.getId()));
                        })
                .toList();
    }

    public OutletServiceResponse toggleService(
            Long outletId, Long serviceId, OutletServiceToggleRequest r) {
        Outlet o = outlet(outletId);
        CatalogService s = service(serviceId);
        com.sanasboutique.backend.outlet.entity.OutletService a =
                assignments
                        .findByOutletIdAndServiceId(o.getId(), s.getId())
                        .orElseGet(
                                () ->
                                        new com.sanasboutique.backend.outlet.entity.OutletService(
                                                o, s));
        a.setActive(r.allowed());
        assignments.save(a);
        return serviceMapper.toResponse(
                s, r.allowed(), items.countByOutletIdAndServiceId(o.getId(), s.getId()));
    }

    @Transactional(readOnly = true)
    public Page<OutletServiceItemResponse> items(
            Long outletId, Long serviceId, String search, int page, int size) {
        Outlet o = outlet(outletId);
        CatalogService s = service(serviceId);
        String q = search == null ? "" : search.trim();
        int safeSize = Math.min(Math.max(size, 1), 100);
        PageRequest pageable =
                PageRequest.of(Math.max(page, 0), safeSize, Sort.by("name").ascending());
        return items.searchForOutletService(o.getId(), s.getId(), q, pageable)
                .map(i -> itemMapper.toResponse(i, i.isActive(), i.getQuantity()));
    }

    public ServiceItemResponse setItemActive(
            Long outletId, Long serviceId, Long itemId, boolean active) {
        allowedService(outletId, serviceId);
        return itemService.setActiveForOutlet(outletId, serviceId, itemId, active);
    }

    public boolean isUsable(Long outletId, ServiceItem i) {
        if (!i.isActive() || !outletId.equals(i.getOutletId()) || !i.getService().isActive())
            return false;
        return assignments
                .findByOutletIdAndServiceId(outletId, i.getService().getId())
                .map(com.sanasboutique.backend.outlet.entity.OutletService::isActive)
                .orElse(false);
    }

    @Transactional(readOnly = true)
    public List<OutletServiceItemResponse> searchItems(Long outletId, String search) {
        Outlet o = outlet(outletId);
        String q = search == null ? "" : search.trim().toLowerCase();
        List<OutletServiceItemResponse> result = new ArrayList<>();
        for (com.sanasboutique.backend.outlet.entity.OutletService a :
                assignments.findByOutletId(o.getId())) {
            if (!a.isActive() || !a.getService().isActive()) continue;
            for (ServiceItem i :
                    items.findByOutletIdAndServiceIdOrderByNameAsc(
                            o.getId(), a.getService().getId())) {
                if (!i.isActive()) continue;
                if (q.isEmpty()
                        || (i.getItemCode() != null && i.getItemCode().toLowerCase().contains(q))
                        || i.getName().toLowerCase().contains(q)
                        || String.valueOf(i.getId()).equals(q)) {
                    result.add(itemMapper.toResponse(i, true, i.getQuantity()));
                    if (result.size() >= 50) return result;
                }
            }
        }
        return result;
    }

    @Transactional(readOnly = true)
    public OutletServiceItemResponse findItemByCode(Long outletId, String code) {
        String c = code == null ? "" : code.trim();
        ServiceItem item =
                items.findByItemCodeIgnoreCaseAndOutletId(c, outletId)
                        .orElseThrow(() -> new ResourceNotFoundException("No product with that code"));
        boolean allowed =
                assignments.findByOutletId(outletId).stream()
                        .anyMatch(
                                a ->
                                        a.isActive()
                                                && a.getService()
                                                        .getId()
                                                        .equals(item.getService().getId()));
        return itemMapper.toResponse(item, allowed, item.getQuantity());
    }

    public ServiceItemResponse createItem(
            Long outletId, Long serviceId, ServiceItemRequest request) {
        allowedService(outletId, serviceId);
        return itemService.createForOutlet(outletId, serviceId, request);
    }

    public ServiceItemResponse updateItem(
            Long outletId, Long serviceId, Long itemId, ServiceItemRequest request) {
        allowedService(outletId, serviceId);
        return itemService.updateForOutlet(outletId, serviceId, itemId, request);
    }

    private CatalogService allowedService(Long outletId, Long serviceId) {
        CatalogService s = service(serviceId);
        if (!s.isActive()
                || assignments
                        .findByOutletIdAndServiceId(outletId, serviceId)
                        .map(a -> !a.isActive())
                        .orElse(true))
            throw new ResourceNotFoundException("Service is not enabled for this outlet");
        return s;
    }

    private Outlet outlet(Long id) {
        return outlets.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Outlet not found"));
    }

    private CatalogService service(Long id) {
        return services.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Service not found"));
    }
}
