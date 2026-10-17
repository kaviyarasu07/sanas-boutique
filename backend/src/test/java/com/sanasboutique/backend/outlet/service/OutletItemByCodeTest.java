package com.sanasboutique.backend.outlet.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.sanasboutique.backend.catalog.entity.CatalogService;
import com.sanasboutique.backend.catalog.entity.ServiceItem;
import com.sanasboutique.backend.catalog.exception.ResourceNotFoundException;
import com.sanasboutique.backend.catalog.repository.CatalogServiceRepository;
import com.sanasboutique.backend.catalog.repository.ServiceItemRepository;
import com.sanasboutique.backend.outlet.dto.response.OutletServiceItemResponse;
import com.sanasboutique.backend.outlet.mapper.OutletServiceItemMapper;
import com.sanasboutique.backend.outlet.mapper.OutletServiceMapper;
import com.sanasboutique.backend.outlet.repository.OutletRepository;
import com.sanasboutique.backend.outlet.repository.OutletServiceItemRepository;
import com.sanasboutique.backend.outlet.repository.OutletServiceRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

/** Scan / price check lookup: always scoped to the caller's own outlet. */
class OutletItemByCodeTest {
    private static final long MY_OUTLET = 1L;
    private static final long OTHER_OUTLET = 2L;

    private ServiceItemRepository items;
    private OutletServiceRepository assignments;
    private OutletServiceItemMapper itemMapper;
    private OutletServiceAssignmentServiceImpl service;

    @BeforeEach
    void setUp() {
        items = mock(ServiceItemRepository.class);
        assignments = mock(OutletServiceRepository.class);
        itemMapper = mock(OutletServiceItemMapper.class);
        service =
                new OutletServiceAssignmentServiceImpl(
                        mock(OutletRepository.class),
                        assignments,
                        mock(OutletServiceItemRepository.class),
                        mock(CatalogServiceRepository.class),
                        items,
                        mock(OutletServiceMapper.class),
                        itemMapper,
                        null);
    }

    @Test
    void codeFromAnotherOutletIsNotFound() {
        when(items.findByItemCodeIgnoreCaseAndOutletId("SB-000007", OTHER_OUTLET))
                .thenReturn(Optional.empty());

        assertThrows(
                ResourceNotFoundException.class,
                () -> service.findItemByCode(OTHER_OUTLET, "SB-000007"));
    }

    @Test
    void lookupAlwaysUsesTheCallersOutletAndTrimsTheCode() {
        ServiceItem item = itemInService(10L);
        when(items.findByItemCodeIgnoreCaseAndOutletId("sb-000007", MY_OUTLET))
                .thenReturn(Optional.of(item));
        when(assignments.findByOutletId(MY_OUTLET)).thenReturn(List.of());
        OutletServiceItemResponse expected = mock(OutletServiceItemResponse.class);
        when(itemMapper.toResponse(any(), org.mockito.ArgumentMatchers.anyBoolean(), any()))
                .thenReturn(expected);

        assertEquals(expected, service.findItemByCode(MY_OUTLET, "  sb-000007 "));
        verify(items).findByItemCodeIgnoreCaseAndOutletId("sb-000007", MY_OUTLET);
    }

    @Test
    void serviceNotEnabledForOutletIsReportedAsNotAllowed() {
        ServiceItem item = itemInService(10L);
        when(items.findByItemCodeIgnoreCaseAndOutletId("SB-000007", MY_OUTLET))
                .thenReturn(Optional.of(item));
        when(assignments.findByOutletId(MY_OUTLET)).thenReturn(List.of());

        service.findItemByCode(MY_OUTLET, "SB-000007");

        verify(itemMapper).toResponse(item, false, item.getQuantity());
    }

    @Test
    void enabledServiceIsReportedAsAllowed() {
        ServiceItem item = itemInService(10L);
        when(items.findByItemCodeIgnoreCaseAndOutletId("SB-000007", MY_OUTLET))
                .thenReturn(Optional.of(item));
        var assignment = mock(com.sanasboutique.backend.outlet.entity.OutletService.class);
        when(assignment.isActive()).thenReturn(true);
        CatalogService itemsService = item.getService();
        when(assignment.getService()).thenReturn(itemsService);
        when(assignments.findByOutletId(MY_OUTLET)).thenReturn(List.of(assignment));

        service.findItemByCode(MY_OUTLET, "SB-000007");

        verify(itemMapper).toResponse(item, true, item.getQuantity());
    }

    private static ServiceItem itemInService(long serviceId) {
        CatalogService catalogService = mock(CatalogService.class);
        when(catalogService.getId()).thenReturn(serviceId);
        ServiceItem item = mock(ServiceItem.class);
        when(item.getService()).thenReturn(catalogService);
        when(item.getQuantity()).thenReturn(5);
        when(item.isActive()).thenReturn(true);
        return item;
    }
}
