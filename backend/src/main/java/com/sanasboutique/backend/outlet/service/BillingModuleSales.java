package com.sanasboutique.backend.outlet.service;

import com.sanasboutique.backend.catalog.repository.ServiceItemRepository;
import com.sanasboutique.backend.common.OutletModule;
import com.sanasboutique.backend.outlet.dto.response.OutletServiceItemResponse;
import com.sanasboutique.backend.outlet.mapper.OutletServiceItemMapper;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;

/** Items of a franchisor-created billing module at one outlet (for its billing screen). Bills are made by BillService. */
@Service
@Transactional(readOnly = true)
public class BillingModuleSales {
    private final ServiceItemRepository items;
    private final OutletServiceAssignmentService assignments;
    private final OutletServiceItemMapper mapper;

    public BillingModuleSales(ServiceItemRepository items, OutletServiceAssignmentService assignments, OutletServiceItemMapper mapper) {
        this.items = items;
        this.assignments = assignments;
        this.mapper = mapper;
    }

    /** This outlet's active items whose service is in the billing module, matching name or code. */
    public List<OutletServiceItemResponse> items(Long outletId, Long billingModuleId, String search) {
        String q = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        return items.findActiveForOutletModule(outletId, OutletModule.CUSTOM).stream()
                .filter(i -> i.getService().getBillingModule() != null && i.getService().getBillingModule().getId().equals(billingModuleId))
                .filter(i -> assignments.isUsable(outletId, i))
                .filter(i -> q.isEmpty() || i.getName().toLowerCase(Locale.ROOT).contains(q) || (i.getItemCode() != null && i.getItemCode().toLowerCase(Locale.ROOT).contains(q)))
                .map(i -> mapper.toResponse(i, true, i.getQuantity()))
                .toList();
    }
}
