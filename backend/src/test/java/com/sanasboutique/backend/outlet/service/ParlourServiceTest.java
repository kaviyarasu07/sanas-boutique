package com.sanasboutique.backend.outlet.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.sanasboutique.backend.catalog.entity.CatalogService;
import com.sanasboutique.backend.catalog.entity.PriceUnit;
import com.sanasboutique.backend.catalog.entity.ServiceItem;
import com.sanasboutique.backend.catalog.exception.ResourceNotFoundException;
import com.sanasboutique.backend.catalog.repository.CatalogServiceRepository;
import com.sanasboutique.backend.catalog.repository.PriceUnitRepository;
import com.sanasboutique.backend.catalog.repository.ServiceItemRepository;
import com.sanasboutique.backend.common.OutletModule;
import com.sanasboutique.backend.outlet.dto.request.*;
import com.sanasboutique.backend.outlet.dto.response.*;
import com.sanasboutique.backend.outlet.entity.*;
import com.sanasboutique.backend.outlet.repository.*;
import com.sanasboutique.backend.user.AppUser;
import com.sanasboutique.backend.user.AppUserRepository;
import com.sanasboutique.backend.user.Role;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.function.Executable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

/**
 * Parlour: walk-in and booked bills (fixed prices, discount only, P numbers), booking, cancel,
 * cancel & reschedule, the "Not done by end of day" system cancel (job and first-use sweep), and
 * that one outlet can never read or change another outlet's appointments.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ParlourServiceTest {
    private static final LocalDate TODAY = LocalDate.now(ZoneId.of("Asia/Kolkata"));
    private static final LocalTime ELEVEN = LocalTime.of(11, 0);
    private static final String PRIYA = "9876543210";

    @Autowired ParlourService service;
    @Autowired ParlourAutoCancelJobRunner job;
    @Autowired LogActors actors;
    @Autowired FranchiseRepository franchises;
    @Autowired AppUserRepository users;
    @Autowired OutletRepository outlets;
    @Autowired OutletServiceRepository outletServices;
    @Autowired PriceUnitRepository priceUnits;
    @Autowired CatalogServiceRepository catalog;
    @Autowired ServiceItemRepository serviceItems;
    @Autowired BookingRepository bookings;
    @Autowired OutletCustomerRepository customers;

    private Long outletA, outletB;
    private ServiceItem facialA, threadingA, facialB, sareeA;
    private LogActor staffA, staffB;

    /** The scheduled job bean is switched off in tests; this runs the same loop on demand. */
    @org.springframework.boot.test.context.TestConfiguration
    static class Config {
        @org.springframework.context.annotation.Bean
        ParlourAutoCancelJobRunner runner(ParlourService s) {
            return new ParlourAutoCancelJobRunner(s);
        }
    }

    static class ParlourAutoCancelJobRunner extends ParlourAutoCancelJob {
        ParlourAutoCancelJobRunner(ParlourService s) {
            super(s);
        }
    }

    @BeforeEach
    void setUp() {
        String tag = UUID.randomUUID().toString().substring(0, 8);
        PriceUnit flat = priceUnits.save(new PriceUnit("Flat " + tag));
        CatalogService parlour = new CatalogService("Facial " + tag, null, flat);
        parlour.setModule(OutletModule.PARLOUR);
        parlour = catalog.save(parlour);
        CatalogService shop = catalog.save(new CatalogService("Sarees " + tag, null, flat));

        outletA = outlet("Anna Nagar", "AN" + tag, "90000" + tag.hashCode() % 100000);
        outletB = outlet("Besant Nagar", "BN" + tag, "91000" + tag.hashCode() % 100000);
        for (Long o : List.of(outletA, outletB)) {
            outletServices.save(new com.sanasboutique.backend.outlet.entity.OutletService(outlets.findById(o).orElseThrow(), parlour));
            outletServices.save(new com.sanasboutique.backend.outlet.entity.OutletService(outlets.findById(o).orElseThrow(), shop));
        }
        facialA = item(parlour, "Gold facial", "1200", outletA);
        threadingA = item(parlour, "Threading", "50", outletA);
        facialB = item(parlour, "Gold facial", "1500", outletB);
        sareeA = item(shop, "Silk saree", "5000", outletA);
        staffA = actors.of("outlet-an" + tag.toLowerCase(), null);
        staffB = actors.of("outlet-bn" + tag.toLowerCase(), null);
    }

    // ------------------------------------------------------------ walk-in bill

    @Test
    void walkInBillUsesFixedPricesAndADiscountAndIsAParlourBill() {
        BillResponse bill = service.bill(outletA, walkIn(new BigDecimal("100"), line(facialA, 1), line(threadingA, 2)), staffA);

        assertThat(bill.billNumber()).contains("-P-");
        assertThat(bill.module()).isEqualTo("PARLOUR");
        assertThat(bill.subtotal()).isEqualByComparingTo("1300");
        assertThat(bill.total()).isEqualByComparingTo("1200");
        assertThat(service.bills(outletA, "", 0, null, null).content()).extracting(BillResponse::billNumber).contains(bill.billNumber());
    }

    @Test
    void onlyParlourServicesOfThisOutletCanBeBilled() {
        assertThrows(IllegalArgumentException.class, () -> service.bill(outletA, walkIn(null, line(sareeA, 1)), staffA));
        assertThrows(ResourceNotFoundException.class, () -> service.bill(outletA, walkIn(null, line(facialB, 1)), staffA));
        assertThrows(IllegalArgumentException.class, () -> service.bill(outletA, walkIn(new BigDecimal("1201"), line(facialA, 1)), staffA));
    }

    @Test
    void theServiceGridShowsOnlyThisOutletsParlourServices() {
        List<ParlourServiceGroup> grid = service.services(outletA);
        assertThat(grid).singleElement().satisfies(g -> assertThat(g.items()).extracting(ParlourServiceGroup.Item::name).containsExactly("Gold facial", "Threading"));
    }

    // ------------------------------------------------------------ booked customer on the day

    @Test
    void bookedCustomerIsBilledOnTheDayWithServicesAddedAndRemoved() {
        ParlourAppointmentResponse booked = book(outletA, TODAY, line(facialA, 1), line(threadingA, 1));
        assertThat(booked.bookingNumber()).contains("-BK-");
        assertThat(booked.estimate()).isEqualByComparingTo("1250");

        BillResponse bill = service.bill(outletA, new ParlourBillRequest(null, null, List.of(line(facialA, 2)), BigDecimal.ZERO, booked.id(), null), staffA);

        assertThat(bill.total()).isEqualByComparingTo("2400");
        ParlourAppointmentResponse done = service.get(outletA, booked.id());
        assertThat(done.status()).isEqualTo("DONE");
        assertThat(done.bill().billNumber()).isEqualTo(bill.billNumber());
        assertThat(service.log(outletA, booked.id())).extracting(BookingLogResponse::message)
                .anySatisfy(m -> assertThat(m).contains("Billed", "added Gold facial", "removed Threading"));

        assertThrows(IllegalArgumentException.class,
                () -> service.bill(outletA, new ParlourBillRequest(null, null, List.of(line(facialA, 1)), null, booked.id(), null), staffA));
    }

    @Test
    void aFutureBookingCannotBeBilledToday() {
        ParlourAppointmentResponse booked = book(outletA, TODAY.plusDays(2), line(facialA, 1));
        assertThrows(IllegalArgumentException.class,
                () -> service.bill(outletA, new ParlourBillRequest(null, null, List.of(line(facialA, 1)), null, booked.id(), null), staffA));
    }

    @Test
    void bookingInThePastIsRejected() {
        assertThrows(IllegalArgumentException.class, () -> book(outletA, TODAY.minusDays(1), line(facialA, 1)));
    }

    // ------------------------------------------------------------ cancel, cancel & reschedule

    @Test
    void cancelByHandKeepsTheReason() {
        ParlourAppointmentResponse b = book(outletA, TODAY.plusDays(1), line(facialA, 1));
        ParlourAppointmentResponse c = service.cancel(outletA, b.id(), new ParlourCancelRequest("Didn't come", null, null), staffA);
        assertThat(c.status()).isEqualTo("CANCELLED");
        assertThat(c.autoCancelled()).isFalse();
        assertThat(c.cancelReason()).isEqualTo("Didn't come");
    }

    @Test
    void cancelAndRescheduleCreatesALinkedBookingWithTheSameServices() {
        ParlourAppointmentResponse old = book(outletA, TODAY, line(facialA, 1), line(threadingA, 2));

        ParlourAppointmentResponse next =
                service.cancelAndReschedule(outletA, old.id(), new ParlourRescheduleRequest(TODAY.plusDays(3), LocalTime.of(16, 30), null), staffA);

        assertThat(next.status()).isEqualTo("BOOKED");
        assertThat(next.date()).isEqualTo(TODAY.plusDays(3));
        assertThat(next.items()).extracting(ParlourAppointmentResponse.Item::quantity).containsExactly(1, 2);
        assertThat(next.rescheduledFrom()).isEqualTo(old.bookingNumber());
        ParlourAppointmentResponse was = service.get(outletA, old.id());
        assertThat(was.status()).isEqualTo("CANCELLED");
        assertThat(was.rescheduledTo()).isEqualTo(next.bookingNumber());
        assertThat(was.cancelReason()).startsWith("Rescheduled to").contains(next.bookingNumber());

        assertThrows(IllegalArgumentException.class,
                () -> service.cancelAndReschedule(outletA, next.id(), new ParlourRescheduleRequest(TODAY.minusDays(1), ELEVEN, null), staffA));
    }

    // ------------------------------------------------------------ "Not done by end of day"

    @Test
    void theSixAmJobCancelsEarlierDaysOnlyAndIsSafeToRepeat() {
        Long yesterday = pastAppointment(outletA, 1);
        Long lastWeek = pastAppointment(outletB, 7);
        ParlourAppointmentResponse today = book(outletA, TODAY, line(facialA, 1));

        job.run();
        job.run(); // repeat: nothing more to do

        assertAutoCancelled(outletA, yesterday);
        assertAutoCancelled(outletB, lastWeek);
        assertThat(service.get(outletA, today.id()).status()).isEqualTo("BOOKED");
        assertThat(service.log(outletA, yesterday).stream().filter(l -> l.kind().equals("AUTO_CANCELLED"))).hasSize(1);
        assertThat(service.search(outletA, "NOT_DONE", "", 0).content()).extracting(ParlourAppointmentResponse::id).containsExactly(yesterday);
    }

    @Test
    void firstUseOfTheDayCancelsOnlyThisOutletsLeftovers() {
        Long mine = pastAppointment(outletA, 1);
        Long theirs = pastAppointment(outletB, 1);

        service.day(outletA, TODAY); // opening Parlour

        assertThat(bookings.findById(mine).orElseThrow().isAutoCancelled()).isTrue();
        assertThat(bookings.findById(theirs).orElseThrow().getStatus()).isEqualTo(BookingStatus.BOOKED);
    }

    // ------------------------------------------------------------ tenancy

    @Test
    void anotherOutletCanNeverReadOrChangeTheAppointment() {
        ParlourAppointmentResponse b = book(outletA, TODAY, line(facialA, 1));
        Long id = b.id();
        List<Executable> calls =
                List.of(
                        () -> service.get(outletB, id),
                        () -> service.lookup(outletB, b.bookingNumber()),
                        () -> service.log(outletB, id),
                        () -> service.comment(outletB, id, new CommentRequest("x", null), staffB),
                        () -> service.cancel(outletB, id, new ParlourCancelRequest("x", null, null), staffB),
                        () -> service.cancelAndReschedule(outletB, id, new ParlourRescheduleRequest(TODAY.plusDays(1), ELEVEN, null), staffB),
                        () -> service.bill(outletB, new ParlourBillRequest(null, null, List.of(line(facialB, 1)), null, id, null), staffB));
        for (Executable call : calls) assertThrows(ResourceNotFoundException.class, call);

        assertThat(service.day(outletB, TODAY)).isEmpty();
        assertThat(service.search(outletB, "ALL", "", 0).content()).isEmpty();
        assertThat(service.bills(outletB, "", 0, null, null).content()).isEmpty();
        assertThat(service.get(outletA, id).status()).isEqualTo("BOOKED");
    }

    // ------------------------------------------------------------ helpers

    private void assertAutoCancelled(Long outletId, Long id) {
        ParlourAppointmentResponse r = service.get(outletId, id);
        assertThat(r.status()).isEqualTo("CANCELLED");
        assertThat(r.autoCancelled()).isTrue();
        assertThat(r.cancelReason()).isEqualTo("Not done by end of day");
    }

    /** An appointment left Booked on an earlier day (cannot be made through the service, so saved directly). */
    private Long pastAppointment(Long outletId, int daysAgo) {
        Outlet o = outlets.findById(outletId).orElseThrow();
        OutletCustomer c = customers.save(new OutletCustomer(o, "98" + String.format("%08d", Math.abs((outletId * 31 + daysAgo) % 100000000)), "Old customer"));
        Booking b = new Booking(o, c, BookingKind.APPOINTMENT, TODAY.minusDays(daysAgo), ELEVEN, null, null);
        b.getItems().add(new BookingItem(b, outletId.equals(outletA) ? facialA : facialB, 1));
        return bookings.saveAndFlush(b).getId();
    }

    private ParlourAppointmentResponse book(Long outletId, LocalDate date, ParlourLine... lines) {
        return service.book(outletId, new ParlourAppointmentRequest("Priya", PRIYA, date, ELEVEN, List.of(lines), null, null), outletId.equals(outletA) ? staffA : staffB);
    }

    private static ParlourBillRequest walkIn(BigDecimal discount, ParlourLine... lines) {
        return new ParlourBillRequest("Priya", PRIYA, List.of(lines), discount, null, null);
    }

    private static ParlourLine line(ServiceItem i, int qty) {
        return new ParlourLine(i.getId(), qty);
    }

    private ServiceItem item(CatalogService s, String name, String price, Long outletId) {
        ServiceItem i = new ServiceItem(s, name, null, new BigDecimal(price), null);
        i.setOutletId(outletId);
        return serviceItems.save(i);
    }

    private Long outlet(String name, String code, String mobile) {
        Franchise f = franchises.save(new Franchise(name, code));
        String m = (mobile + "0000000000").substring(0, 10);
        AppUser u = users.save(new AppUser(f.getId(), "outlet-" + code.toLowerCase(), m, "x", name + " login", Role.OUTLET));
        return outlets.save(new Outlet(f.getId(), name, "Owner", "Main Road", m, code.toLowerCase() + "@shop.test", u.getId())).getId();
    }
}
