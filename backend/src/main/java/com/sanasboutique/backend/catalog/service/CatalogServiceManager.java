package com.sanasboutique.backend.catalog.service;

import com.sanasboutique.backend.catalog.dto.request.ActiveRequest;
import com.sanasboutique.backend.catalog.dto.request.ServiceRequest;
import com.sanasboutique.backend.catalog.dto.response.ServiceResponse;
import com.sanasboutique.backend.catalog.entity.CatalogService;
import com.sanasboutique.backend.catalog.entity.PriceUnit;
import com.sanasboutique.backend.catalog.exception.DuplicateResourceException;
import com.sanasboutique.backend.catalog.exception.ResourceNotFoundException;
import com.sanasboutique.backend.catalog.mapper.ServiceMapper;
import com.sanasboutique.backend.catalog.repository.CatalogServiceRepository;
import com.sanasboutique.backend.catalog.repository.PriceUnitRepository;
import com.sanasboutique.backend.catalog.repository.ServiceItemRepository;
import com.sanasboutique.backend.outlet.repository.OutletServiceRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class CatalogServiceManager {
    private final CatalogServiceRepository repository;
    private final PriceUnitRepository priceUnits;
    private final ServiceItemRepository items;
    private final OutletServiceRepository outletServices;
    private final ServiceMapper mapper;
    private final BillingModuleService billingModules;

    public CatalogServiceManager(
            CatalogServiceRepository repository,
            PriceUnitRepository priceUnits,
            ServiceItemRepository items,
            ServiceMapper mapper,
            OutletServiceRepository outletServices,
            BillingModuleService billingModules) {
        this.repository = repository;
        this.priceUnits = priceUnits;
        this.items = items;
        this.mapper = mapper;
        this.outletServices = outletServices;
        this.billingModules = billingModules;
    }

    /** A built-in module, or (module CUSTOM) a franchisor-created billing module. Absent = unchanged (new services default to Shop sales). */
    private void applyModule(CatalogService service, ServiceRequest request) {
        if (request.module() == null) return;
        com.sanasboutique.backend.common.OutletModule m = com.sanasboutique.backend.common.OutletModule.valueOf(request.module());
        if (m == com.sanasboutique.backend.common.OutletModule.CUSTOM) {
            if (request.billingModuleId() == null) throw new IllegalArgumentException("Choose which billing module");
            service.setBillingModule(billingModules.find(request.billingModuleId()));
        } else service.setModule(m);
    }

    @Transactional(readOnly = true)
    public List<ServiceResponse> list() {
        return repository.findAll().stream()
                .map(s -> mapper.toResponse(s, items.countByServiceId(s.getId())))
                .toList();
    }

    public ServiceResponse create(ServiceRequest request) {
        String name = request.name().trim();
        if (repository.existsByNameIgnoreCase(name))
            throw new DuplicateResourceException("A service with that name already exists");
        CatalogService created =
                new CatalogService(
                        name, blankToNull(request.description()), priceUnit(request.priceUnitId()));
        created.setBookingMode(request.bookingMode());
        created.setPrebookEnabled(Boolean.TRUE.equals(request.prebookEnabled()));
        applyModule(created, request);
        return mapper.toResponse(repository.save(created), 0);
    }

    public ServiceResponse update(Long id, ServiceRequest request) {
        CatalogService service = find(id);
        String name = request.name().trim();
        if (!name.equalsIgnoreCase(service.getName()) && repository.existsByNameIgnoreCase(name)) {
            throw new DuplicateResourceException("A service with that name already exists");
        }
        service.setName(name);
        service.setDescription(blankToNull(request.description()));
        service.setPriceUnit(priceUnit(request.priceUnitId()));
        service.setBookingMode(request.bookingMode());
        service.setPrebookEnabled(Boolean.TRUE.equals(request.prebookEnabled()));
        applyModule(service, request);
        return mapper.toResponse(repository.save(service), items.countByServiceId(id));
    }

    public ServiceResponse setActive(Long id, ActiveRequest request) {
        CatalogService service = find(id);
        service.setActive(request.active());
        if (!request.active()) {
            outletServices.disableForService(id);
        }
        return mapper.toResponse(repository.save(service), items.countByServiceId(id));
    }

    public CatalogService find(Long id) {
        return repository
                .findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Service not found"));
    }

    private PriceUnit priceUnit(Long id) {
        return priceUnits
                .findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Price unit not found"));
    }

    private static String blankToNull(String value) {
        if (value == null) return null;
        String s = value.trim();
        return s.isEmpty() ? null : s;
    }
}
