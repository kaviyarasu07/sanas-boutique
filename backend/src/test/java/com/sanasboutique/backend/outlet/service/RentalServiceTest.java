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
 * Jewellery rental: booking blocks pieces, Rent now, hand-over with pieces added/removed, the return
 * check with damage / repair / missing and the rent for the days, repairs, cancel & reschedule, the
 * login check (no scheduler), and that one outlet can never read or change another outlet's rentals.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class RentalServiceTest {
    private static final LocalDate TODAY = LocalDate.now(ZoneId.of("Asia/Kolkata"));
    private static final String PRIYA = "9876543210";

    @Autowired RentalService service;
    @Autowired ParlourService parlour;
    @Autowired LeftoverBookings leftovers;
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

    private Long outletA, outletB, franchiseA;
    private ServiceItem necklace, chain, jhumka, necklaceB, facial;
    private LogActor staffA, staffB;

    @BeforeEach
    void setUp() {
        String tag = UUID.randomUUID().toString().substring(0, 8);
        PriceUnit perDay = priceUnits.save(new PriceUnit("Per Day " + tag));
        CatalogService rental = new CatalogService("Jewellery " + tag, null, perDay);
        rental.setModule(OutletModule.RENTAL);
        rental = catalog.save(rental);
        CatalogService parlourService = new CatalogService("Facial " + tag, null, perDay);
        parlourService.setModule(OutletModule.PARLOUR);
        parlourService = catalog.save(parlourService);

        outletA = outlet("Anna Nagar", "AN" + tag, "9" + Math.abs(tag.hashCode() % 1000000000));
        franchiseA = outlets.findById(outletA).orElseThrow().getFranchiseId();
        outletB = outlet("Besant Nagar", "BN" + tag, "8" + Math.abs(tag.hashCode() % 1000000000));
        for (Long o : List.of(outletA, outletB))
            for (CatalogService s : List.of(rental, parlourService))
                outletServices.save(new com.sanasboutique.backend.outlet.entity.OutletService(outlets.findById(o).orElseThrow(), s));
        necklace = item(rental, "Bridal necklace", "1000", 1, "50000", outletA);
        chain = item(rental, "Gold chain", "200", 5, "8000", outletA);
        jhumka = item(rental, "Jhumka", "300", 2, null, outletA);
        necklaceB = item(rental, "Bridal necklace", "1200", 1, null, outletB);
        facial = item(parlourService, "Gold facial", "1200", null, null, outletA);
        staffA = actors.of("outlet-an" + tag.toLowerCase(), null);
        staffB = actors.of("outlet-bn" + tag.toLowerCase(), null);
    }

    // ------------------------------------------------------------ booking blocks pieces

    @Test
    void aBookedPieceCannotBeBookedByAnotherCustomerForOverlappingDays() {
        RentalBookingResponse b = book(outletA, TODAY.plusDays(4), TODAY.plusDays(6), line(necklace, 1), line(chain, 5));
        assertThat(b.bookingNumber()).contains("-BK-");
        assertThat(b.status()).isEqualTo("BOOKED");
        assertThat(b.days()).isEqualTo(2);
        assertThat(b.estimate()).isEqualByComparingTo("4000"); // (1000 + 5 × 200) × 2 days

        IllegalArgumentException e = assertThrows(IllegalArgumentException.class, () -> book(outletA, TODAY.plusDays(5), TODAY.plusDays(7), line(necklace, 1)));
        assertThat(e.getMessage()).contains("Bridal necklace");
        assertThat(book(outletA, TODAY.plusDays(7), TODAY.plusDays(8), line(necklace, 1)).status()).isEqualTo("BOOKED");
    }

    @Test
    void onlyJewelleryRentalPiecesOfThisOutletCanBeBooked() {
        assertThrows(IllegalArgumentException.class, () -> book(outletA, TODAY, TODAY.plusDays(1), line(facial, 1)));
        assertThrows(ResourceNotFoundException.class, () -> book(outletA, TODAY, TODAY.plusDays(1), line(necklaceB, 1)));
        assertThrows(IllegalArgumentException.class, () -> book(outletA, TODAY.minusDays(1), TODAY.plusDays(1), line(necklace, 1)));
        assertThat(service.products(outletA, "")).extracting(RentalProductResponse::name).containsExactly("Bridal necklace", "Gold chain", "Jhumka");
    }

    // ------------------------------------------------------------ rent now, hand over

    @Test
    void rentNowHandsOverAtOnceWithAChallanAndTakesThePiecesOutOfStock() {
        RentalBookingResponse r = service.rentNow(outletA, request(null, TODAY.plusDays(2), line(chain, 2)), staffA);

        assertThat(r.status()).isEqualTo("WITH_CUSTOMER");
        assertThat(r.handedOverOn()).isEqualTo(TODAY);
        assertThat(r.challan().type()).isEqualTo("CHALLAN");
        assertThat(r.challan().billNumber()).contains("-DC-");
        assertThat(r.challan().total()).isEqualByComparingTo("0");
        assertThat(serviceItems.findById(chain.getId()).orElseThrow().getQuantity()).isEqualTo(3);
    }

    @Test
    void handOverCanRemoveAndAddPiecesAndChangeTheReturnDate() {
        RentalBookingResponse b = book(outletA, TODAY, TODAY.plusDays(2), line(necklace, 1), line(chain, 5));

        RentalBookingResponse h = service.handOver(outletA, b.id(),
                new RentalHandOverRequest(TODAY.plusDays(3), List.of(chain.getId()), List.of(line(jhumka, 1)), null), staffA);

        assertThat(h.status()).isEqualTo("WITH_CUSTOMER");
        assertThat(h.returnDate()).isEqualTo(TODAY.plusDays(3));
        assertThat(h.items()).extracting(RentalBookingResponse.Item::name).containsExactlyInAnyOrder("Bridal necklace", "Jhumka");
        assertThat(h.items()).filteredOn(i -> i.name().equals("Jhumka")).singleElement().satisfies(i -> assertThat(i.addedQty()).isEqualTo(1));
        assertThat(h.estimate()).isEqualByComparingTo("3900"); // (1000 + 300) × 3 days
        assertThat(service.log(outletA, b.id())).extracting(BookingLogResponse::message)
                .anySatisfy(m -> assertThat(m).contains("Handed over", "added Jhumka", "removed Gold chain"));
        assertThrows(IllegalArgumentException.class, () -> service.handOver(outletA, b.id(), new RentalHandOverRequest(TODAY.plusDays(3), null, null, null), staffA));
    }

    // ------------------------------------------------------------ return and bill

    @Test
    void returnBillsRentForTheDaysPlusDamageAndMissingAndMovesTheStock() {
        RentalBookingResponse r = service.rentNow(outletA, request(null, TODAY.plusDays(2), line(necklace, 1), line(chain, 5)), staffA);

        RentalBookingResponse done = service.returnRental(outletA, r.id(), new RentalReturnRequest(BigDecimal.ZERO, List.of(
                new RentalReturnRequest.Piece(necklace.getId(), 1, 0, 0, 0, null, null, null),
                new RentalReturnRequest.Piece(chain.getId(), 3, 1, 1, 1, new BigDecimal("300"), "Broken clasp", new BigDecimal("8000"))), null), staffA);

        assertThat(done.status()).isEqualTo("RETURNED");
        BillResponse bill = done.bill();
        assertThat(bill.billNumber()).contains("-R-");
        assertThat(bill.module()).isEqualTo("RENTAL");
        assertThat(bill.total()).isEqualByComparingTo("10300"); // rent (1000 + 5 × 200) × 1 day + damage 300 + missing 8000
        assertThat(bill.items()).extracting(BillItemResponse::itemName).anySatisfy(n -> assertThat(n).contains("damage", "Broken clasp")).anySatisfy(n -> assertThat(n).contains("missing"));
        // chains: 5 out → 3 OK back, 1 to repair, 1 missing written off; necklace back
        assertThat(serviceItems.findById(chain.getId()).orElseThrow().getQuantity()).isEqualTo(3);
        assertThat(serviceItems.findById(necklace.getId()).orElseThrow().getQuantity()).isEqualTo(1);

        List<RepairResponse> repairs = service.repairs(outletA);
        assertThat(repairs).singleElement().satisfies(x -> { assertThat(x.itemName()).isEqualTo("Gold chain"); assertThat(x.note()).isEqualTo("Broken clasp"); });
        service.backInStock(outletA, repairs.get(0).id(), staffA);
        assertThat(serviceItems.findById(chain.getId()).orElseThrow().getQuantity()).isEqualTo(4);
        assertThat(service.repairs(outletA)).isEmpty();
    }

    @Test
    void lateReturnIsChargedForTheExtraDaysOnly() {
        Long id = withCustomer(outletA, chain, 1, TODAY.minusDays(3), TODAY.minusDays(1)); // took 3 days ago, due yesterday
        assertThat(service.dashboard(outletA).late()).extracting(RentalBookingResponse::id).contains(id);

        RentalBookingResponse done = service.returnRental(outletA, id, new RentalReturnRequest(null, List.of(new RentalReturnRequest.Piece(chain.getId(), 1, 0, 0, 0, null, null, null)), null), staffA);
        assertThat(done.days()).isEqualTo(3);
        assertThat(done.bill().total()).isEqualByComparingTo("600"); // 200 × 3 days, no fine
    }

    @Test
    void everyPieceGivenMustBeCheckedBeforeTheBill() {
        RentalBookingResponse r = service.rentNow(outletA, request(null, TODAY.plusDays(1), line(necklace, 1), line(chain, 2)), staffA);
        Long id = r.id();
        assertThrows(IllegalArgumentException.class, () -> service.returnRental(outletA, id, new RentalReturnRequest(null, List.of(
                new RentalReturnRequest.Piece(necklace.getId(), 1, 0, 0, 0, null, null, null)), null), staffA)); // chain not checked
        assertThrows(IllegalArgumentException.class, () -> service.returnRental(outletA, id, new RentalReturnRequest(null, List.of(
                new RentalReturnRequest.Piece(necklace.getId(), 1, 0, 0, 0, null, null, null),
                new RentalReturnRequest.Piece(chain.getId(), 1, 0, 0, 0, null, null, null)), null), staffA)); // 2 given, 1 counted
        assertThrows(IllegalArgumentException.class, () -> service.returnRental(outletA, id, new RentalReturnRequest(null, List.of(
                new RentalReturnRequest.Piece(necklace.getId(), 1, 0, 0, 0, null, null, null),
                new RentalReturnRequest.Piece(chain.getId(), 1, 1, 0, 0, null, null, null)), null), staffA)); // damage charge missing
    }

    @Test
    void daysAreReturnDateMinusTakeAwayDateWithAMinimumOfOne() {
        assertThat(RentalService.days(LocalDate.of(2026, 10, 14), LocalDate.of(2026, 10, 16))).isEqualTo(2);
        assertThat(RentalService.days(LocalDate.of(2026, 10, 14), LocalDate.of(2026, 10, 14))).isEqualTo(1);
    }

    // ------------------------------------------------------------ cancel & reschedule

    @Test
    void cancelAndRescheduleBooksTheSamePiecesForNewDates() {
        RentalBookingResponse old = book(outletA, TODAY.plusDays(2), TODAY.plusDays(3), line(necklace, 1));
        RentalBookingResponse next = service.cancelAndReschedule(outletA, old.id(), new RentalRescheduleRequest(TODAY.plusDays(10), TODAY.plusDays(12), null), staffA);

        assertThat(next.status()).isEqualTo("BOOKED");
        assertThat(next.rescheduledFrom()).isEqualTo(old.bookingNumber());
        RentalBookingResponse was = service.get(outletA, old.id());
        assertThat(was.status()).isEqualTo("CANCELLED");
        assertThat(was.rescheduledTo()).isEqualTo(next.bookingNumber());
        // the old dates are free again
        assertThat(book(outletA, TODAY.plusDays(2), TODAY.plusDays(3), line(necklace, 1)).status()).isEqualTo("BOOKED");
    }

    // ------------------------------------------------------------ the login check (no scheduler)

    @Test
    void loginCancelsThisOutletsUncollectedPreBookingsAndParlourLeftoversOnly() {
        Long rentalA = staleRental(outletA, necklace);
        Long rentalB = staleRental(outletB, necklaceB);
        Long parlourA = staleAppointment(outletA);
        RentalBookingResponse today = book(outletA, TODAY, TODAY.plusDays(1), line(chain, 1));

        leftovers.cancelAtLogin(franchiseA);

        Booking ra = bookings.findById(rentalA).orElseThrow();
        assertThat(ra.getStatus()).isEqualTo(BookingStatus.CANCELLED);
        assertThat(ra.isAutoCancelled()).isTrue();
        assertThat(ra.getCancelReason()).isEqualTo("Not collected by the booked date");
        assertThat(bookings.findById(parlourA).orElseThrow().isAutoCancelled()).isTrue();
        assertThat(bookings.findById(rentalB).orElseThrow().getStatus()).isEqualTo(BookingStatus.BOOKED);
        assertThat(service.get(outletA, today.id()).status()).isEqualTo("BOOKED");
        assertThat(service.search(outletA, "NOT_COLLECTED", "", 0).content()).extracting(RentalBookingResponse::id).containsExactly(rentalA);
    }

    // ------------------------------------------------------------ tenancy

    @Test
    void anotherOutletCanNeverReadOrChangeTheRental() {
        RentalBookingResponse b = book(outletA, TODAY, TODAY.plusDays(2), line(necklace, 1));
        Long id = b.id();
        List<Executable> calls = List.of(
                () -> service.get(outletB, id),
                () -> service.lookup(outletB, b.bookingNumber()),
                () -> service.log(outletB, id),
                () -> service.comment(outletB, id, new CommentRequest("x", null), staffB),
                () -> service.handOver(outletB, id, new RentalHandOverRequest(TODAY.plusDays(2), null, null, null), staffB),
                () -> service.returnRental(outletB, id, new RentalReturnRequest(null, List.of(new RentalReturnRequest.Piece(necklace.getId(), 1, 0, 0, 0, null, null, null)), null), staffB),
                () -> service.cancel(outletB, id, new ParlourCancelRequest("x", null, null), staffB),
                () -> service.cancelAndReschedule(outletB, id, new RentalRescheduleRequest(TODAY.plusDays(5), TODAY.plusDays(6), null), staffB),
                () -> service.availability(outletB, necklace.getId(), TODAY, TODAY.plusDays(1), 1));
        for (Executable call : calls) assertThrows(ResourceNotFoundException.class, call);

        assertThat(service.day(outletB, TODAY)).isEmpty();
        assertThat(service.search(outletB, "ALL", "", 0).content()).isEmpty();
        assertThat(service.dashboard(outletB).toCollect()).isEmpty();
        assertThat(service.products(outletB, "")).extracting(RentalProductResponse::id).containsExactly(necklaceB.getId());
        assertThat(service.get(outletA, id).status()).isEqualTo("BOOKED");
    }

    @Test
    void anotherOutletCannotMarkARepairBackInStock() {
        RentalBookingResponse r = service.rentNow(outletA, request(null, TODAY.plusDays(1), line(chain, 1)), staffA);
        service.returnRental(outletA, r.id(), new RentalReturnRequest(null, List.of(new RentalReturnRequest.Piece(chain.getId(), 0, 1, 1, 0, BigDecimal.ZERO, "Bent", null)), null), staffA);
        Long repair = service.repairs(outletA).get(0).id();
        assertThrows(ResourceNotFoundException.class, () -> service.backInStock(outletB, repair, staffB));
        assertThat(service.repairs(outletB)).isEmpty();
    }

    // ------------------------------------------------------------ helpers

    private RentalBookingResponse book(Long outletId, LocalDate from, LocalDate to, RentalLine... lines) {
        return service.book(outletId, request(from, to, lines), outletId.equals(outletA) ? staffA : staffB);
    }

    private static RentalBookRequest request(LocalDate from, LocalDate to, RentalLine... lines) {
        return new RentalBookRequest("Priya", PRIYA, from, to, List.of(lines), null, null);
    }

    private static RentalLine line(ServiceItem i, int qty) {
        return new RentalLine(i.getId(), qty);
    }

    /** A rental already with the customer since an earlier day (cannot be made through the service, so saved directly). */
    private Long withCustomer(Long outletId, ServiceItem item, int qty, LocalDate took, LocalDate due) {
        Booking b = new Booking(outlets.findById(outletId).orElseThrow(), customer(outletId, "9123456780"), BookingKind.RENTAL, took, null, due, null);
        b.getItems().add(new BookingItem(b, item, qty));
        b.setHandedOverOn(took);
        b.setStatus(BookingStatus.HANDED_OVER);
        ServiceItem i = serviceItems.findById(item.getId()).orElseThrow();
        i.setQuantity(i.getQuantity() - qty);
        return bookings.saveAndFlush(b).getId();
    }

    private Long staleRental(Long outletId, ServiceItem item) {
        Booking b = new Booking(outlets.findById(outletId).orElseThrow(), customer(outletId, "9111111111"), BookingKind.RENTAL, TODAY.minusDays(1), null, TODAY.plusDays(1), null);
        b.getItems().add(new BookingItem(b, item, 1));
        return bookings.saveAndFlush(b).getId();
    }

    private Long staleAppointment(Long outletId) {
        Booking b = new Booking(outlets.findById(outletId).orElseThrow(), customer(outletId, "9222222222"), BookingKind.APPOINTMENT, TODAY.minusDays(1), LocalTime.of(11, 0), null, null);
        b.getItems().add(new BookingItem(b, facial, 1));
        return bookings.saveAndFlush(b).getId();
    }

    private OutletCustomer customer(Long outletId, String mobile) {
        return customers.findByOutletIdAndMobileNumber(outletId, mobile)
                .orElseGet(() -> customers.save(new OutletCustomer(outlets.findById(outletId).orElseThrow(), mobile, "Old customer")));
    }

    private ServiceItem item(CatalogService s, String name, String price, Integer qty, String valueIfLost, Long outletId) {
        ServiceItem i = new ServiceItem(s, name, null, new BigDecimal(price), qty);
        i.setOutletId(outletId);
        if (valueIfLost != null) i.setReplacementValue(new BigDecimal(valueIfLost));
        return serviceItems.save(i);
    }

    private Long outlet(String name, String code, String mobile) {
        Franchise f = franchises.save(new Franchise(name, code));
        String m = (mobile + "0000000000").substring(0, 10);
        AppUser u = users.save(new AppUser(f.getId(), "outlet-" + code.toLowerCase(), m, "x", name + " login", Role.OUTLET));
        return outlets.save(new Outlet(f.getId(), name, "Owner", "Main Road", m, code.toLowerCase() + "@shop.test", u.getId())).getId();
    }
}
