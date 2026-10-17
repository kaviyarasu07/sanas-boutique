package com.sanasboutique.backend.outlet.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.sanasboutique.backend.catalog.dto.request.BillingModuleRequest;
import com.sanasboutique.backend.catalog.dto.request.ServiceRequest;
import com.sanasboutique.backend.catalog.dto.response.BillingModuleResponse;
import com.sanasboutique.backend.catalog.dto.response.ServiceResponse;
import com.sanasboutique.backend.catalog.entity.PriceUnit;
import com.sanasboutique.backend.catalog.entity.ServiceItem;
import com.sanasboutique.backend.catalog.exception.ResourceNotFoundException;
import com.sanasboutique.backend.catalog.repository.CatalogServiceRepository;
import com.sanasboutique.backend.catalog.repository.PriceUnitRepository;
import com.sanasboutique.backend.catalog.repository.ServiceItemRepository;
import com.sanasboutique.backend.catalog.service.BillingModuleService;
import com.sanasboutique.backend.catalog.service.CatalogServiceManager;
import com.sanasboutique.backend.outlet.dto.request.BillLineRequest;
import com.sanasboutique.backend.outlet.dto.request.BillRequest;
import com.sanasboutique.backend.outlet.dto.response.BillResponse;
import com.sanasboutique.backend.outlet.entity.*;
import com.sanasboutique.backend.outlet.repository.*;
import com.sanasboutique.backend.security.AuthenticatedUser;
import com.sanasboutique.backend.user.AppUser;
import com.sanasboutique.backend.user.AppUserRepository;
import com.sanasboutique.backend.user.Role;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Franchisor-created billing modules: automatic bill codes, putting a service in one, outlets seeing
 * only the modules they were given (and not switched-off ones), and bills holding only that module's items.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class BillingModuleTest {
    @Autowired BillingModuleService modules;
    @Autowired CatalogServiceManager services;
    @Autowired ModuleAccess access;
    @Autowired BillingModuleSales sales;
    @Autowired BillService bills;
    @Autowired CatalogServiceRepository catalog;
    @Autowired PriceUnitRepository priceUnits;
    @Autowired ServiceItemRepository items;
    @Autowired FranchiseRepository franchises;
    @Autowired AppUserRepository users;
    @Autowired OutletRepository outlets;
    @Autowired OutletServiceRepository outletServices;

    private String tag;
    private Long unitId;

    @BeforeEach
    void setUp() {
        tag = UUID.randomUUID().toString().substring(0, 6);
        unitId = priceUnits.save(new PriceUnit("Piece " + tag)).getId();
    }

    @Test
    void billCodesAreMadeFromTheNameAndNeverRepeatOrClashWithAppCodes() {
        assertThat(create("Bangle sales").code()).isEqualTo("BS");
        assertThat(create("Bridal sets").code()).isEqualTo("BS2"); // BS is taken
        assertThat(modules.previewCode("Saree pre pleating")).isEqualTo("SPP");
        assertThat(modules.previewCode("Delivery charges")).isEqualTo("DC2"); // DC is the delivery challan code
        assertThat(modules.previewCode("Mehendi")).isEqualTo("ME");
        assertThat(modules.previewCode("")).isEqualTo("M");
    }

    @Test
    void aServiceCanBePutInABillingModule() {
        BillingModuleResponse m = create("Bangle sales " + tag);
        ServiceResponse s = services.create(new ServiceRequest("Bangles " + tag, null, unitId, null, false, "CUSTOM", m.id()));
        assertThat(s.module()).isEqualTo("CUSTOM");
        assertThat(s.billingModuleName()).isEqualTo(m.name());
        assertThrows(IllegalArgumentException.class, () -> services.create(new ServiceRequest("Rings " + tag, null, unitId, null, false, "CUSTOM", null)));
    }

    @Test
    void outletsSeeOnlyGivenAndSwitchedOnBillingModules() {
        BillingModuleResponse bangles = create("Bangle sales " + tag), gifts = create("Gift packs " + tag);
        Long serviceId = services.create(new ServiceRequest("Bangles " + tag, null, unitId, null, false, "CUSTOM", bangles.id())).id();
        Outlet a = outlet("A" + tag), b = outlet("B" + tag);
        give(a, serviceId);

        assertThat(access.billingModules(a.getId())).extracting(x -> x.getName()).containsExactly(bangles.name());
        assertThat(access.billingModules(b.getId())).isEmpty();
        assertThat(access.modules(a.getId())).isEmpty(); // a billing module is not a built-in module
        AuthenticatedUser userA = new AuthenticatedUser("a", "OUTLET", a.getFranchiseId()), userB = new AuthenticatedUser("b", "OUTLET", b.getFranchiseId());
        assertThat(access.billingModuleFor(userA, bangles.id()).outletId()).isEqualTo(a.getId());
        assertThrows(ResponseStatusException.class, () -> access.billingModuleFor(userA, gifts.id()));
        assertThrows(ResponseStatusException.class, () -> access.billingModuleFor(userB, bangles.id()));

        modules.setActive(bangles.id(), false);
        assertThat(access.billingModules(a.getId())).isEmpty();
        assertThrows(ResponseStatusException.class, () -> access.billingModuleFor(userA, bangles.id()));
    }

    @Test
    void aBillingModuleBillHoldsOnlyItsOwnItemsAndUsesItsCode() {
        BillingModuleResponse bangles = create("Bangle sales " + tag);
        Long bangleService = services.create(new ServiceRequest("Bangles " + tag, null, unitId, null, false, "CUSTOM", bangles.id())).id();
        Long shopService = services.create(new ServiceRequest("Fabric " + tag, null, unitId, null, false, "SALES", null)).id();
        Outlet a = outlet("A" + tag), b = outlet("B" + tag);
        give(a, bangleService);
        give(a, shopService);
        give(b, bangleService);
        ServiceItem bangle = item(bangleService, "Glass bangle", "150", 10, a.getId());
        ServiceItem fabric = item(shopService, "Silk fabric", "500", null, a.getId());
        ServiceItem bangleOfB = item(bangleService, "Glass bangle", "150", 10, b.getId());
        var module = modules.find(bangles.id());

        assertThat(sales.items(a.getId(), bangles.id(), "")).extracting(i -> i.name()).containsExactly("Glass bangle");
        BillResponse bill = bills.createInBillingModule(a.getId(), module, request(bangle, 2));
        assertThat(bill.billNumber()).contains("-" + bangles.code() + "-");
        assertThat(bill.module()).isEqualTo("CUSTOM");
        assertThat(bill.total()).isEqualByComparingTo("300");
        assertThat(items.findById(bangle.getId()).orElseThrow().getQuantity()).isEqualTo(8);
        assertThat(bills.recentInBillingModule(a.getId(), bangles.id())).extracting(BillResponse::billNumber).containsExactly(bill.billNumber());

        assertThrows(IllegalArgumentException.class, () -> bills.createInBillingModule(a.getId(), module, request(fabric, 1)));
        assertThrows(IllegalArgumentException.class, () -> bills.create(a.getId(), request(bangle, 1))); // not a shop product
        assertThrows(ResourceNotFoundException.class, () -> bills.createInBillingModule(a.getId(), module, request(bangleOfB, 1))); // another outlet's item
        assertThat(bills.recentInBillingModule(b.getId(), bangles.id())).isEmpty();
    }

    private BillingModuleResponse create(String name) {
        return modules.create(new BillingModuleRequest(name, "bag"));
    }

    private static BillRequest request(ServiceItem i, int qty) {
        return new BillRequest("Priya", "9876543210", BigDecimal.ZERO, List.of(new BillLineRequest(i.getId(), qty)));
    }

    private void give(Outlet o, Long serviceId) {
        outletServices.save(new com.sanasboutique.backend.outlet.entity.OutletService(o, catalog.findById(serviceId).orElseThrow()));
    }

    private ServiceItem item(Long serviceId, String name, String price, Integer qty, Long outletId) {
        ServiceItem i = new ServiceItem(catalog.findById(serviceId).orElseThrow(), name, null, new BigDecimal(price), qty);
        i.setOutletId(outletId);
        return items.save(i);
    }

    private Outlet outlet(String code) {
        Franchise f = franchises.save(new Franchise("Outlet " + code, code));
        String m = ("9" + Math.abs(code.hashCode()) + "000000000").substring(0, 10);
        AppUser u = users.save(new AppUser(f.getId(), "outlet-" + code, m, "x", "Outlet " + code, Role.OUTLET));
        return outlets.save(new Outlet(f.getId(), "Outlet " + code, "Owner", null, m, code + "@shop.test", u.getId()));
    }
}
