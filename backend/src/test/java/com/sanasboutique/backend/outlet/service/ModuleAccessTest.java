package com.sanasboutique.backend.outlet.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.sanasboutique.backend.catalog.entity.CatalogService;
import com.sanasboutique.backend.catalog.entity.PriceUnit;
import com.sanasboutique.backend.catalog.entity.ServiceItem;
import com.sanasboutique.backend.catalog.repository.CatalogServiceRepository;
import com.sanasboutique.backend.catalog.repository.PriceUnitRepository;
import com.sanasboutique.backend.catalog.repository.ServiceItemRepository;
import com.sanasboutique.backend.common.OutletModule;
import com.sanasboutique.backend.outlet.dto.request.BillLineRequest;
import com.sanasboutique.backend.outlet.dto.request.BillRequest;
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
import java.util.Set;
import java.util.UUID;

/**
 * An outlet sees and uses only the modules of the services the franchisor gave it, and each module
 * bills only its own items (Shop sales refuses rental / parlour items).
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ModuleAccessTest {
    @Autowired ModuleAccess access;
    @Autowired BillService bills;
    @Autowired FranchiseRepository franchises;
    @Autowired AppUserRepository users;
    @Autowired OutletRepository outlets;
    @Autowired OutletServiceRepository outletServices;
    @Autowired PriceUnitRepository priceUnits;
    @Autowired CatalogServiceRepository catalog;
    @Autowired ServiceItemRepository items;

    private Long franchiseA, outletA;
    private CatalogService parlour, shop, rental;

    @BeforeEach
    void setUp() {
        String tag = UUID.randomUUID().toString().substring(0, 8);
        PriceUnit unit = priceUnits.save(new PriceUnit("Unit " + tag));
        parlour = service("Parlour " + tag, unit, OutletModule.PARLOUR);
        shop = service("Fabric " + tag, unit, OutletModule.SALES);
        rental = service("Jewellery " + tag, unit, OutletModule.RENTAL);
        Franchise f = franchises.save(new Franchise("Anna Nagar", "AN" + tag));
        franchiseA = f.getId();
        String m = ("9" + Math.abs(tag.hashCode()) + "000000000").substring(0, 10);
        AppUser u = users.save(new AppUser(f.getId(), "outlet-" + tag, m, "x", "Anna Nagar", Role.OUTLET));
        Outlet o = outlets.save(new Outlet(f.getId(), "Anna Nagar", "Owner", null, m, tag + "@shop.test", u.getId()));
        outletA = o.getId();
        outletServices.save(new com.sanasboutique.backend.outlet.entity.OutletService(o, parlour));
        outletServices.save(new com.sanasboutique.backend.outlet.entity.OutletService(o, shop));
        com.sanasboutique.backend.outlet.entity.OutletService off = new com.sanasboutique.backend.outlet.entity.OutletService(o, rental);
        off.setActive(false); // given, then switched off by the franchisor
        outletServices.save(off);
    }

    @Test
    void onlyTheModulesOfServicesGivenToTheOutletAreShown() {
        assertThat(access.modules(outletA)).isEqualTo(Set.of(OutletModule.PARLOUR, OutletModule.SALES));
    }

    @Test
    void aModuleNotGivenToTheOutletIsRefused() {
        AuthenticatedUser user = new AuthenticatedUser("outlet", "OUTLET", franchiseA);
        assertThat(access.outletFor(user, OutletModule.PARLOUR)).isEqualTo(outletA);
        assertThrows(ResponseStatusException.class, () -> access.outletFor(user, OutletModule.RENTAL));
        assertThrows(ResponseStatusException.class, () -> access.outletFor(user, OutletModule.STITCHING));
    }

    @Test
    void shopSalesBillsOnlyShopProducts() {
        ServiceItem fabric = item(shop, "Silk fabric", "500");
        ServiceItem facial = item(parlour, "Gold facial", "1200");
        assertThat(bills.create(outletA, new BillRequest("Priya", "9876543210", BigDecimal.ZERO, List.of(new BillLineRequest(fabric.getId(), 2)))).total())
                .isEqualByComparingTo("1000");
        assertThrows(IllegalArgumentException.class,
                () -> bills.create(outletA, new BillRequest("Priya", "9876543210", BigDecimal.ZERO, List.of(new BillLineRequest(facial.getId(), 1)))));
    }

    private CatalogService service(String name, PriceUnit unit, OutletModule module) {
        CatalogService s = new CatalogService(name, null, unit);
        s.setModule(module);
        return catalog.save(s);
    }

    private ServiceItem item(CatalogService s, String name, String price) {
        ServiceItem i = new ServiceItem(s, name, null, new BigDecimal(price), null);
        i.setOutletId(outletA);
        return items.save(i);
    }
}
