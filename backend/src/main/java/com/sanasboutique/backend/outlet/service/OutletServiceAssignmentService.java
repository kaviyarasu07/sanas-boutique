package com.sanasboutique.backend.outlet.service;

import com.sanasboutique.backend.catalog.dto.request.ServiceItemRequest;
import com.sanasboutique.backend.catalog.dto.response.ServiceItemResponse;
import com.sanasboutique.backend.outlet.dto.request.*;
import com.sanasboutique.backend.outlet.dto.response.*;

import org.springframework.data.domain.Page;

import java.util.List;

public interface OutletServiceAssignmentService {
    List<OutletServiceResponse> services(Long outletId);

    OutletServiceResponse toggleService(
            Long outletId, Long serviceId, OutletServiceToggleRequest request);

    Page<OutletServiceItemResponse> items(
            Long outletId, Long serviceId, String search, int page, int size);

    ServiceItemResponse setItemActive(Long outletId, Long serviceId, Long itemId, boolean active);

    /** True when the item is this outlet's own, active, and its service is enabled for the outlet. */
    boolean isUsable(Long outletId, com.sanasboutique.backend.catalog.entity.ServiceItem item);

    List<OutletServiceItemResponse> searchItems(Long outletId, String search);

    /**
     * Current details of one of this outlet's own products, found by its scanned code. Inactive
     * products are still returned (price check); "allowed" says whether its service is enabled.
     */
    OutletServiceItemResponse findItemByCode(Long outletId, String code);

    ServiceItemResponse createItem(Long outletId, Long serviceId, ServiceItemRequest request);

    ServiceItemResponse updateItem(
            Long outletId, Long serviceId, Long itemId, ServiceItemRequest request);
}
