package com.sanasboutique.backend.outlet.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.sanasboutique.backend.catalog.exception.ResourceNotFoundException;
import com.sanasboutique.backend.outlet.dto.request.*;
import com.sanasboutique.backend.outlet.dto.response.*;
import com.sanasboutique.backend.outlet.entity.*;
import com.sanasboutique.backend.outlet.repository.*;
import com.sanasboutique.backend.user.AppUser;
import com.sanasboutique.backend.user.AppUserRepository;
import com.sanasboutique.backend.user.Role;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import org.junit.jupiter.api.function.Executable;

/**
 * Stitching orders: per-garment status, partial delivery with advances used bill by bill, refunds
 * decided by the outlet, the order log, previous measurements, and (most important) that one outlet
 * can never read or change another outlet's orders.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class StitchServiceTest {
    private static final LocalDate TODAY = LocalDate.now(ZoneId.of("Asia/Kolkata"));
    private static final String PRIYA = "9876543210";

    @Autowired StitchService service;
    @Autowired FranchiseRepository franchises;
    @Autowired AppUserRepository users;
    @Autowired OutletRepository outlets;
    @Autowired BillRepository bills;

    private Long outletA;
    private Long outletB;
    private LogActor staffA;
    private LogActor staffB;

    @BeforeEach
    void setUp() {
        outletA = outlet("Anna Nagar", "AN", "9000000001");
        outletB = outlet("Besant Nagar", "BN", "9000000002");
        staffA = service.actor("outlet-an", null);
        staffB = service.actor("outlet-bn", null);
    }

    // ------------------------------------------------------------ order, receipt, advance

    @Test
    void newOrderWithAdvanceAndPriceToAddLater() {
        StitchOrderResponse o =
                create(outletA, new BigDecimal("500"), garment("Blouse", "800", 3), garment("Salwar", null, 5));

        assertThat(o.orderNumber()).startsWith("STC-");
        assertThat(o.status()).isEqualTo("OPEN");
        assertThat(o.items()).extracting(StitchOrderResponse.Item::status).containsOnly("NOT_STARTED");
        assertThat(o.total()).isEqualByComparingTo("800");
        assertThat(o.unpricedCount()).isEqualTo(1);
        assertThat(o.advancePaid()).isEqualByComparingTo("500");
        assertThat(o.advanceAvailable()).isEqualByComparingTo("500");
        assertThat(o.estimatedDeliveryDate()).isEqualTo(TODAY.plusDays(3));
        assertThat(service.log(outletA, o.id()))
                .singleElement()
                .satisfies(
                        l -> {
                            assertThat(l.kind()).isEqualTo("CREATED");
                            assertThat(l.message()).contains("2 garments", "1 price to add", "advance ₹500");
                            assertThat(l.authorName()).isEqualTo("Anna Nagar login");
                        });
    }

    @Test
    void severalAdvancesButNotMoreThanTheTotalOnceEverythingIsPriced() {
        StitchOrderResponse o = create(outletA, new BigDecimal("500"), garment("Blouse", "800", 3));
        o = service.addAdvance(outletA, o.id(), new StitchAdvanceRequest(new BigDecimal("300"), null), staffA);
        assertThat(o.advancePaid()).isEqualByComparingTo("800");

        Long id = o.id();
        assertThrows(
                IllegalArgumentException.class,
                () -> service.addAdvance(outletA, id, new StitchAdvanceRequest(BigDecimal.ONE, null), staffA));
    }

    @Test
    void pastDeliveryDateIsRejected() {
        assertThrows(
                IllegalArgumentException.class,
                () -> create(outletA, null, garment("Blouse", "800", -1)));
    }

    // ------------------------------------------------------------ status

    @Test
    void statusMovesForwardAndBackAndEveryChangeIsLogged() {
        StitchOrderResponse o = create(outletA, null, garment("Blouse", "800", 3));
        Long item = o.items().get(0).id();

        status(outletA, o.id(), item, "STARTED");
        status(outletA, o.id(), item, "FINISHED");
        o = status(outletA, o.id(), item, "STARTED"); // marked finished by mistake

        assertThat(o.items().get(0).status()).isEqualTo("STARTED");
        assertThat(o.items().get(0).finishedAt()).isNull();
        assertThat(service.log(outletA, o.id()))
                .extracting(StitchLogResponse::message)
                .contains("Blouse: Not started → Started", "Blouse: Started → Finished", "Blouse: Finished → Started");
    }

    @Test
    void deliveredIsNotAStatusStaffCanPick() {
        StitchOrderResponse o = create(outletA, null, garment("Blouse", "800", 3));
        assertThrows(
                IllegalArgumentException.class,
                () -> status(outletA, o.id(), o.items().get(0).id(), "DELIVERED"));
    }

    // ------------------------------------------------------------ partial delivery and advance

    @Test
    void partialDeliveryUsesTheAdvanceOnTheFirstBillAndCarriesNothingWhenUsedUp() {
        StitchOrderResponse o =
                create(
                        outletA,
                        new BigDecimal("1000"),
                        garment("Blouse", "800", 2),
                        garment("Salwar", "1000", 2),
                        garment("Lehenga", "3000", 10));
        Long blouse = o.items().get(0).id(), salwar = o.items().get(1).id(), lehenga = o.items().get(2).id();
        status(outletA, o.id(), blouse, "FINISHED");
        status(outletA, o.id(), salwar, "FINISHED");

        o = deliver(outletA, o.id(), List.of(blouse, salwar), null, null);

        BillResponse first = o.bills().get(0);
        assertThat(first.billNumber()).contains("-ST-");
        assertThat(first.module()).isEqualTo("STITCHING");
        assertThat(first.total()).isEqualByComparingTo("1800");
        assertThat(first.advancePaid()).isEqualByComparingTo("1000");
        assertThat(first.balance()).isEqualByComparingTo("800");
        assertThat(o.status()).isEqualTo("OPEN");
        assertThat(o.advanceAvailable()).isEqualByComparingTo("0");
        assertThat(o.estimatedDeliveryDate()).isEqualTo(TODAY.plusDays(10));

        status(outletA, o.id(), lehenga, "FINISHED");
        o = deliver(outletA, o.id(), List.of(lehenga), null, null);

        assertThat(o.bills()).hasSize(2);
        assertThat(o.bills().get(1).advancePaid()).isEqualByComparingTo("0");
        assertThat(o.bills().get(1).balance()).isEqualByComparingTo("3000");
        assertThat(o.status()).isEqualTo("DELIVERED");
    }

    @Test
    void onlyFinishedGarmentsWithAPriceCanBeDelivered() {
        StitchOrderResponse o = create(outletA, null, garment("Blouse", null, 2), garment("Salwar", "900", 2));
        Long blouse = o.items().get(0).id(), salwar = o.items().get(1).id(), id = o.id();

        assertThrows(IllegalArgumentException.class, () -> deliver(outletA, id, List.of(salwar), null, null));

        status(outletA, id, blouse, "FINISHED");
        assertThrows(IllegalArgumentException.class, () -> deliver(outletA, id, List.of(blouse), null, null));

        o = deliver(outletA, id, List.of(blouse), List.of(new StitchDeliverRequest.Price(blouse, new BigDecimal("750"))), null);
        assertThat(o.bills().get(0).total()).isEqualByComparingTo("750");
        assertThat(service.log(outletA, id)).extracting(StitchLogResponse::message).contains("Price of Blouse: added ₹750");
    }

    // ------------------------------------------------------------ cancel and refund

    @Test
    void cancelledOrderWithAdvanceIsRefundedByTheAmountTheOutletDecides() {
        StitchOrderResponse o = create(outletA, new BigDecimal("1000"), garment("Lehenga", "3000", 10));
        o = service.cancel(outletA, o.id(), new StitchCancelRequest(null, "Customer cancelled", "Wedding postponed", null), staffA);
        assertThat(o.status()).isEqualTo("CANCELLED");
        assertThat(o.advanceAvailable()).isEqualByComparingTo("1000");

        o = service.refund(outletA, o.id(), new StitchRefundRequest(new BigDecimal("700"), "Customer cancelled", null), staffA);

        StitchOrderResponse.Payment refund = o.payments().get(1);
        assertThat(refund.kind()).isEqualTo("REFUND");
        assertThat(refund.amount()).isEqualByComparingTo("700");
        assertThat(refund.keptAmount()).isEqualByComparingTo("300");
        assertThat(refund.refundNumber()).contains("-RF-");
        assertThat(o.advanceAvailable()).isEqualByComparingTo("0");

        Long id = o.id();
        assertThrows(
                IllegalArgumentException.class,
                () -> service.refund(outletA, id, new StitchRefundRequest(BigDecimal.ONE, null, null), staffA));
    }

    @Test
    void refundCannotBeMoreThanTheAdvanceLeft() {
        StitchOrderResponse o = create(outletA, new BigDecimal("500"), garment("Blouse", "800", 2));
        Long id = service.cancel(outletA, o.id(), new StitchCancelRequest(List.of(), "Customer cancelled", null, null), staffA).id();
        assertThrows(
                IllegalArgumentException.class,
                () -> service.refund(outletA, id, new StitchRefundRequest(new BigDecimal("501"), null, null), staffA));
    }

    @Test
    void cancellingOneGarmentKeepsTheRestOpen() {
        StitchOrderResponse o = create(outletA, null, garment("Blouse", "800", 2), garment("Salwar", "900", 2));
        o = service.cancel(outletA, o.id(), new StitchCancelRequest(List.of(o.items().get(1).id()), "Fabric problem", null, null), staffA);
        assertThat(o.status()).isEqualTo("OPEN");
        assertThat(o.items().get(1).status()).isEqualTo("CANCELLED");
        assertThat(o.total()).isEqualByComparingTo("800");
    }

    // ------------------------------------------------------------ comments

    @Test
    void commentsAreAllowedAfterDeliveryAndShowWhoWroteThem() {
        StitchOrderResponse o = create(outletA, null, garment("Blouse", "800", 2));
        status(outletA, o.id(), o.items().get(0).id(), "FINISHED");
        deliver(outletA, o.id(), List.of(o.items().get(0).id()), null, null);

        List<StitchLogResponse> timeline =
                service.comment(outletA, o.id(), new StitchCommentRequest("Customer happy with fitting", "Kavya"), service.actor("outlet-an", "Kavya"));

        assertThat(timeline.get(timeline.size() - 1))
                .satisfies(
                        l -> {
                            assertThat(l.kind()).isEqualTo("COMMENT");
                            assertThat(l.message()).isEqualTo("Customer happy with fitting");
                            assertThat(l.authorName()).isEqualTo("Kavya");
                        });
    }

    // ------------------------------------------------------------ previous measurements

    @Test
    void previousMeasurementsBelongToTheCustomerAtThisOutletAndKeepTheirDate() {
        StitchOrderResponse first = create(outletA, null, garment("Blouse", "800", 2));
        StitchMeasurementResponse previous = service.measurements(outletA, PRIYA).get(0);
        assertThat(previous.measurements()).isEqualTo("Bust 36, Waist 30");
        assertThat(previous.orderNumber()).isEqualTo(first.orderNumber());

        StitchItemRequest copied =
                new StitchItemRequest("Blouse", "Bust 36, Waist 30", null, TODAY.plusDays(4), null, previous.itemId(), null);
        StitchOrderResponse second = service.create(outletA, order(null, copied), staffA);
        assertThat(second.items().get(0).measuredOn()).isEqualTo(previous.measuredOn());

        assertThat(service.measurements(outletB, PRIYA)).isEmpty();
        assertThrows(ResourceNotFoundException.class, () -> service.create(outletB, order(null, copied), staffB));
    }

    // ------------------------------------------------------------ tenancy: outlet B never sees outlet A

    @Test
    void anotherOutletCanNeverReadOrChangeTheOrder() {
        StitchOrderResponse o = create(outletA, new BigDecimal("500"), garment("Blouse", "800", 2));
        Long id = o.id(), item = o.items().get(0).id();

        List<Executable> calls =
                List.of(
                        () -> service.get(outletB, id),
                        () -> service.lookup(outletB, o.orderNumber()),
                        () -> service.log(outletB, id),
                        () -> service.updateOrder(outletB, id, new StitchOrderUpdateRequest("x", null, null, null), staffB),
                        () -> service.addItem(outletB, id, garment("Kurti", "500", 2), staffB),
                        () -> service.updateItem(outletB, id, item, garment("Blouse", "1", 2), staffB),
                        () -> status(outletB, id, item, "STARTED"),
                        () -> service.addAdvance(outletB, id, new StitchAdvanceRequest(BigDecimal.TEN, null), staffB),
                        () -> deliver(outletB, id, List.of(item), null, null),
                        () -> service.cancel(outletB, id, new StitchCancelRequest(null, "x", null, null), staffB),
                        () -> service.refund(outletB, id, new StitchRefundRequest(BigDecimal.ONE, null, null), staffB),
                        () -> service.comment(outletB, id, new StitchCommentRequest("x", null), staffB));
        for (Executable call : calls) assertThrows(ResourceNotFoundException.class, call);

        assertThat(service.list(outletB, "ALL", "", 0).content()).isEmpty();
        assertThat(service.due(outletB, TODAY.plusDays(2))).isEmpty();
        assertThat(service.day(outletB, TODAY.plusDays(2))).isEmpty();
        assertThat(service.overdue(outletB)).isEmpty();
        assertThat(service.upcoming(outletB)).isEmpty();
        // Outlet A's own view is untouched.
        assertThat(service.get(outletA, id).advancePaid()).isEqualByComparingTo("500");
        assertThat(service.list(outletA, "OPEN", "", 0).content()).hasSize(1);
    }

    @Test
    void inHousePurchaseWithoutABillAndSwitchingBackIsLogged() {
        StitchOrderRequest r =
                new StitchOrderRequest("Priya", PRIYA, null, List.of(garment("Blouse", "800", 2)), null, "IN_HOUSE", null, null);
        StitchOrderResponse o = service.create(outletA, r, staffA);
        assertThat(o.fabricSource()).isEqualTo("IN_HOUSE");
        assertThat(o.fabricBill()).isNull();

        o = service.updateOrder(outletA, o.id(), new StitchOrderUpdateRequest(null, "OWN", null, null), staffA);
        assertThat(o.fabricSource()).isEqualTo("OWN");
        assertThat(service.log(outletA, o.id())).extracting(StitchLogResponse::message).contains("Fabric: customer's own");
    }

    @Test
    void fabricBillMustBeAShopBillOfTheSameOutletAndCustomer() {
        Bill other = bills.save(new Bill(outlets.findById(outletB).orElseThrow(), "BES-000001", "Priya", PRIYA, BigDecimal.ZERO, BigDecimal.TEN, BigDecimal.TEN));
        StitchOrderRequest r =
                new StitchOrderRequest("Priya", PRIYA, null, List.of(garment("Blouse", "800", 2)), null, null, other.getId(), null);
        assertThrows(ResourceNotFoundException.class, () -> service.create(outletA, r, staffA));
        assertThat(service.fabricBills(outletA, PRIYA)).isEmpty();
    }

    // ------------------------------------------------------------ helpers

    private Long outlet(String name, String code, String mobile) {
        Franchise f = franchises.save(new Franchise(name, code));
        AppUser u =
                users.save(
                        new AppUser(f.getId(), "outlet-" + code.toLowerCase(), mobile, "x", name + " login", Role.OUTLET));
        return outlets.save(
                        new Outlet(f.getId(), name, "Owner", "Main Road", mobile, code.toLowerCase() + "@shop.test", u.getId()))
                .getId();
    }

    private StitchItemRequest garment(String name, String price, int daysFromToday) {
        return new StitchItemRequest(
                name,
                "Bust 36, Waist 30",
                null,
                TODAY.plusDays(daysFromToday),
                price == null ? null : new BigDecimal(price),
                null,
                null);
    }

    private StitchOrderRequest order(BigDecimal advance, StitchItemRequest... items) {
        return new StitchOrderRequest("Priya", PRIYA, null, List.of(items), advance, null, null, null);
    }

    private StitchOrderResponse create(Long outletId, BigDecimal advance, StitchItemRequest... items) {
        return service.create(outletId, order(advance, items), outletId.equals(outletA) ? staffA : staffB);
    }

    private StitchOrderResponse status(Long outletId, Long id, Long item, String status) {
        return service.setItemStatus(outletId, id, item, new StitchStatusRequest(status, null), staffA);
    }

    private StitchOrderResponse deliver(
            Long outletId, Long id, List<Long> items, List<StitchDeliverRequest.Price> prices, BigDecimal discount) {
        return service.deliver(outletId, id, new StitchDeliverRequest(items, prices, discount, null), staffA);
    }
}
