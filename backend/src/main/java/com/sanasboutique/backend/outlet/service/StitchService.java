package com.sanasboutique.backend.outlet.service;

import static com.sanasboutique.backend.common.DisplayDates.format;
import static com.sanasboutique.backend.common.DisplayMoney.rupees;

import com.sanasboutique.backend.catalog.exception.ResourceNotFoundException;
import com.sanasboutique.backend.common.OutletModule;
import com.sanasboutique.backend.outlet.dto.request.*;
import com.sanasboutique.backend.outlet.dto.response.*;
import com.sanasboutique.backend.outlet.entity.*;
import com.sanasboutique.backend.outlet.repository.*;

import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.*;
import java.util.*;

/**
 * Stitching orders (docs/features/stitching-orders.md). Every method takes the caller's outlet id
 * (from the JWT) and only ever reads or changes that outlet's orders; another outlet's order is
 * "not found".
 *
 * - An order has one or more garments; each garment has its own delivery date, optional price and
 *   status (Not started / Started / Finished set by staff, moving back allowed; Delivered / Cancelled).
 * - Partial delivery: each delivery bills only the selected finished garments.
 * - Advances are used up bill by bill: each delivery bill takes as much of the advance left as it
 *   needs (Bill.advancePaid). Leftover advance is settled by a refund: the outlet decides how much to
 *   give back, the rest is kept ("Cancellation charges"). Money itself is handled by hand.
 * - Every step and every staff comment is written to the append-only order log.
 */
@Service
@Transactional
public class StitchService {
    private static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");
    static final String SERVICE_LABEL = "Stitching";
    private static final int MEASUREMENT_HISTORY = 30;

    private final StitchOrderRepository orders;
    private final StitchItemRepository items;
    private final StitchPaymentRepository payments;
    private final StitchOrderLogRepository logs;
    private final OutletRepository outlets;
    private final OutletCustomerRepository customers;
    private final BillRepository bills;
    private final LogActors actors;
    private final BillService billService;

    public StitchService(
            StitchOrderRepository orders,
            StitchItemRepository items,
            StitchPaymentRepository payments,
            StitchOrderLogRepository logs,
            OutletRepository outlets,
            OutletCustomerRepository customers,
            BillRepository bills,
            LogActors actors,
            BillService billService) {
        this.orders = orders;
        this.items = items;
        this.payments = payments;
        this.logs = logs;
        this.outlets = outlets;
        this.customers = customers;
        this.bills = bills;
        this.actors = actors;
        this.billService = billService;
    }

    /** Who did it, for the order log ("Your name" if typed, else the login's name). */
    public LogActor actor(String username, String typedName) {
        return actors.of(username, typedName);
    }

    // ---------------------------------------------------------------- create and edit

    public StitchOrderResponse create(Long outletId, StitchOrderRequest r, LogActor a) {
        Outlet outlet =
                outlets.findById(outletId)
                        .orElseThrow(() -> new ResourceNotFoundException("Outlet not found"));
        String mobile = r.customerMobile().trim();
        if (!mobile.matches("[0-9]{10}"))
            throw new IllegalArgumentException("Mobile number must be exactly 10 digits");
        Bill fabric = r.fabricBillId() == null ? null : fabricBill(outletId, mobile, r.fabricBillId());
        for (StitchItemRequest i : r.items())
            if (i.deliveryDate().isBefore(today()))
                throw new IllegalArgumentException(
                        "Delivery date of \"" + i.garment().trim() + "\" cannot be in the past");
        OutletCustomer customer =
                customers
                        .findByOutletIdAndMobileNumber(outletId, mobile)
                        .orElseGet(
                                () ->
                                        customers.save(
                                                new OutletCustomer(
                                                        outlet, mobile, r.customerName().trim())));
        customer.setName(r.customerName().trim());

        StitchOrder o = new StitchOrder(outlet, customer, null, blank(r.notes()));
        for (StitchItemRequest i : r.items()) {
            StitchItem item =
                    new StitchItem(
                            o,
                            i.garment().trim(),
                            blank(i.measurements()),
                            blank(i.notes()),
                            i.deliveryDate(),
                            measuredOn(outletId, mobile, i, null));
            item.setAmount(money(i.amount()));
            o.getItems().add(item);
        }
        o.setFabric(fabricSource(r.fabricSource()), fabric);
        refreshNextDate(o);
        o = orders.saveAndFlush(o);
        o.setOrderNumber("STC-" + String.format("%06d", o.getId()));

        BigDecimal advance = money(r.advance());
        boolean withAdvance = advance != null && advance.signum() > 0;
        if (withAdvance) {
            checkAdvance(o, advance);
            payments.save(StitchPayment.advance(o, advance, a.user(), a.name()));
        }
        Money m = money(o);
        log(
                o,
                null,
                StitchLogKind.CREATED,
                "Order created · "
                        + count(o.getItems().size(), "garment")
                        + " · "
                        + rupees(m.total())
                        + (m.unpriced() > 0 ? " (" + count(m.unpriced(), "price") + " to add)" : "")
                        + (withAdvance ? " · advance " + rupees(advance) : ""),
                null,
                null,
                a);
        return response(o);
    }

    /** Order note and fabric bill. */
    public StitchOrderResponse updateOrder(
            Long outletId, Long id, StitchOrderUpdateRequest r, LogActor a) {
        StitchOrder o = open(load(outletId, id));
        String notes = blank(r.notes());
        if (!Objects.equals(notes, o.getNotes())) {
            o.update(o.getEstimatedDeliveryDate(), notes);
            log(o, null, StitchLogKind.EDIT, "Order note changed", null, null, a);
        }
        Long before = o.getFabricBill() == null ? null : o.getFabricBill().getId();
        FabricSource source = r.fabricBillId() != null ? FabricSource.IN_HOUSE : fabricSource(r.fabricSource());
        if (!Objects.equals(before, r.fabricBillId()) || source != o.getFabricSource()) {
            Bill fabric =
                    r.fabricBillId() == null
                            ? null
                            : fabricBill(outletId, o.getCustomerMobile(), r.fabricBillId());
            o.setFabric(source, fabric);
            log(o, null, StitchLogKind.EDIT, "Fabric: " + fabricText(o), null, null, a);
        }
        return response(o);
    }

    public StitchOrderResponse addItem(Long outletId, Long id, StitchItemRequest r, LogActor a) {
        StitchOrder o = open(load(outletId, id));
        if (r.deliveryDate().isBefore(today()))
            throw new IllegalArgumentException("Delivery date cannot be in the past");
        StitchItem item =
                new StitchItem(
                        o,
                        r.garment().trim(),
                        blank(r.measurements()),
                        blank(r.notes()),
                        r.deliveryDate(),
                        measuredOn(outletId, o.getCustomerMobile(), r, null));
        item.setAmount(money(r.amount()));
        o.getItems().add(item);
        refreshNextDate(o);
        orders.flush();
        log(
                o,
                item,
                StitchLogKind.EDIT,
                "Garment added: "
                        + item.getGarment()
                        + " · delivery "
                        + format(item.getEstimatedDeliveryDate())
                        + (item.getAmount() != null ? " · " + rupees(item.getAmount()) : ""),
                null,
                null,
                a);
        return response(o);
    }

    /** Edit one garment not yet delivered or cancelled; every change is logged. */
    public StitchOrderResponse updateItem(
            Long outletId, Long id, Long itemId, StitchItemRequest r, LogActor a) {
        StitchOrder o = load(outletId, id);
        StitchItem i = openItem(o, itemId);
        String garment = r.garment().trim();
        String measurements = blank(r.measurements());
        String notes = blank(r.notes());
        BigDecimal amount = money(r.amount());
        if (!r.deliveryDate().equals(i.getEstimatedDeliveryDate()) && r.deliveryDate().isBefore(today()))
            throw new IllegalArgumentException("Delivery date cannot be in the past");

        if (!garment.equals(i.getGarment()))
            log(o, i, StitchLogKind.EDIT, "Garment renamed: " + i.getGarment() + " → " + garment, i.getGarment(), garment, a);
        if (!Objects.equals(measurements, i.getMeasurements()) || r.copiedFromItemId() != null) {
            i.setMeasuredOn(measuredOn(outletId, o.getCustomerMobile(), r, i));
            if (!Objects.equals(measurements, i.getMeasurements()))
                log(o, i, StitchLogKind.EDIT, "Measurements of " + garment + " changed", null, null, a);
        }
        if (!Objects.equals(notes, i.getNotes()))
            log(o, i, StitchLogKind.EDIT, "Note of " + garment + " changed", null, null, a);
        if (!sameMoney(amount, i.getAmount())) logPrice(o, i, garment, i.getAmount(), amount, a);
        if (!r.deliveryDate().equals(i.getEstimatedDeliveryDate())) {
            log(
                    o,
                    i,
                    StitchLogKind.DATE,
                    "Delivery date of "
                            + garment
                            + ": "
                            + format(i.getEstimatedDeliveryDate())
                            + " → "
                            + format(r.deliveryDate()),
                    i.getEstimatedDeliveryDate().toString(),
                    r.deliveryDate().toString(),
                    a);
            i.setEstimatedDeliveryDate(r.deliveryDate());
        }
        i.update(garment, measurements, notes);
        i.setAmount(amount);
        refreshNextDate(o);
        return response(o);
    }

    /** Staff-set progress of one garment; moving back is allowed (mistakes happen). */
    public StitchOrderResponse setItemStatus(
            Long outletId, Long id, Long itemId, StitchStatusRequest r, LogActor a) {
        StitchOrder o = load(outletId, id);
        StitchItem i = openItem(o, itemId);
        StitchItemStatus target;
        try {
            target = StitchItemStatus.valueOf(r.status().trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Choose Not started, Started or Finished");
        }
        if (!target.isOpen())
            throw new IllegalArgumentException("Use \"Deliver\" or \"Cancel\" to close a garment");
        if (target == i.getStatus()) return response(o);
        StitchItemStatus from = i.getStatus();
        i.setProgress(target, Instant.now());
        log(
                o,
                i,
                StitchLogKind.STATUS,
                i.getGarment() + ": " + label(from) + " → " + label(target),
                from.name(),
                target.name(),
                a);
        return response(o);
    }

    // ---------------------------------------------------------------- money

    public StitchOrderResponse addAdvance(Long outletId, Long id, StitchAdvanceRequest r, LogActor a) {
        StitchOrder o = open(lock(outletId, id));
        BigDecimal amount = money(r.amount());
        checkAdvance(o, amount);
        payments.save(StitchPayment.advance(o, amount, a.user(), a.name()));
        log(o, null, StitchLogKind.ADVANCE, "Advance " + rupees(amount) + " received", null, amount.toPlainString(), a);
        return response(o);
    }

    /** Partial or full delivery: bills only the selected finished garments and uses the advance left, first bill first. */
    public StitchOrderResponse deliver(Long outletId, Long id, StitchDeliverRequest r, LogActor a) {
        StitchOrder o = open(lock(outletId, id));
        Map<Long, BigDecimal> prices = new HashMap<>();
        if (r.prices() != null) r.prices().forEach(p -> prices.put(p.itemId(), money(p.amount())));
        List<StitchItem> selected = new ArrayList<>();
        for (Long itemId : new LinkedHashSet<>(r.itemIds())) {
            StitchItem i = item(o, itemId);
            if (i.getStatus() != StitchItemStatus.FINISHED)
                throw new IllegalArgumentException(
                        "\""
                                + i.getGarment()
                                + "\" is "
                                + label(i.getStatus()).toLowerCase()
                                + ". Only finished garments can be delivered");
            if (prices.containsKey(itemId) && !sameMoney(prices.get(itemId), i.getAmount())) {
                logPrice(o, i, i.getGarment(), i.getAmount(), prices.get(itemId), a);
                i.setAmount(prices.get(itemId));
            }
            if (i.getAmount() == null)
                throw new IllegalArgumentException("Enter the price for \"" + i.getGarment() + "\"");
            selected.add(i);
        }
        BigDecimal subtotal =
                selected.stream().map(StitchItem::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal discount = Optional.ofNullable(money(r.discount())).orElse(BigDecimal.ZERO);
        if (discount.compareTo(subtotal) > 0)
            throw new IllegalArgumentException("Discount cannot be more than the bill amount");
        BigDecimal billTotal = subtotal.subtract(discount);
        BigDecimal used = money(o).available().min(billTotal).max(BigDecimal.ZERO);

        Bill bill =
                billService.createCustom(
                        o.getOutlet(),
                        o.getCustomer(),
                        discount,
                        selected.stream()
                                .map(
                                        i ->
                                                new BillService.CustomLine(
                                                        i.getGarment() + " (stitching)",
                                                        SERVICE_LABEL,
                                                        i.getAmount()))
                                .toList());
        bill.setAdvancePaid(used);
        Instant now = Instant.now();
        selected.forEach(i -> i.deliver(bill, now));
        log(
                o,
                selected.size() == 1 ? selected.get(0) : null,
                StitchLogKind.DELIVERED,
                "Delivered "
                        + String.join(", ", selected.stream().map(StitchItem::getGarment).toList())
                        + " · bill "
                        + bill.getBillNumber()
                        + (used.signum() > 0 ? " · advance used " + rupees(used) : "")
                        + " · balance "
                        + rupees(billTotal.subtract(used)),
                null,
                bill.getBillNumber(),
                a);
        closeIfDone(o);
        return response(o);
    }

    /** Cancel some (or all remaining) garments with a reason. */
    public StitchOrderResponse cancel(Long outletId, Long id, StitchCancelRequest r, LogActor a) {
        StitchOrder o = open(lock(outletId, id));
        List<StitchItem> targets =
                r.itemIds() == null || r.itemIds().isEmpty()
                        ? o.getItems().stream().filter(i -> i.getStatus().isOpen()).toList()
                        : new LinkedHashSet<>(r.itemIds())
                                .stream().map(itemId -> openItem(o, itemId)).toList();
        if (targets.isEmpty()) throw new IllegalArgumentException("Nothing left to cancel");
        String reason = r.reason().trim();
        String comment = blank(r.comment());
        Instant now = Instant.now();
        targets.forEach(i -> i.cancel(reason, now));
        log(
                o,
                targets.size() == 1 ? targets.get(0) : null,
                StitchLogKind.CANCELLED,
                "Cancelled "
                        + String.join(", ", targets.stream().map(StitchItem::getGarment).toList())
                        + ": "
                        + reason
                        + (comment != null ? " · " + comment : ""),
                null,
                reason,
                a);
        closeIfDone(o);
        return response(o);
    }

    /** Settle the advance left: the outlet decides how much to give back; the rest is kept by the shop. */
    public StitchOrderResponse refund(Long outletId, Long id, StitchRefundRequest r, LogActor a) {
        StitchOrder o = lock(outletId, id);
        BigDecimal available = money(o).available();
        if (available.signum() <= 0)
            throw new IllegalArgumentException("There is no advance left to return");
        BigDecimal returned = money(r.amount());
        if (returned.compareTo(available) > 0)
            throw new IllegalArgumentException("You can return at most " + rupees(available));
        BigDecimal kept = available.subtract(returned);
        StitchPayment p =
                payments.saveAndFlush(
                        StitchPayment.refund(o, returned, kept, blank(r.reason()), a.user(), a.name()));
        p.setRefundNumber(
                BillService.outletPrefix(o.getOutlet()) + "-RF-" + String.format("%06d", p.getId()));
        log(
                o,
                null,
                StitchLogKind.REFUND,
                "Refund "
                        + rupees(returned)
                        + " · kept "
                        + rupees(kept)
                        + " · "
                        + p.getRefundNumber()
                        + (p.getReason() != null ? " · " + p.getReason() : ""),
                null,
                p.getRefundNumber(),
                a);
        return response(o);
    }

    // ---------------------------------------------------------------- log and comments

    /** Comments are allowed at any time, also after delivery. Returns the whole timeline. */
    public List<StitchLogResponse> comment(Long outletId, Long id, StitchCommentRequest r, LogActor a) {
        StitchOrder o = load(outletId, id);
        String text = blank(r.text());
        if (text == null) throw new IllegalArgumentException("Write a comment first");
        log(o, null, StitchLogKind.COMMENT, text, null, null, a);
        return log(outletId, id);
    }

    @Transactional(readOnly = true)
    public List<StitchLogResponse> log(Long outletId, Long id) {
        StitchOrder o = load(outletId, id);
        return logs.findByOrderIdOrderByIdAsc(o.getId()).stream()
                .map(
                        l ->
                                new StitchLogResponse(
                                        l.getId(),
                                        l.getKind().name(),
                                        l.getMessage(),
                                        l.getItem() == null ? null : l.getItem().getGarment(),
                                        l.getAuthorName(),
                                        l.getCreatedAt()))
                .toList();
    }

    // ---------------------------------------------------------------- lists and lookups

    /** view: OPEN, READY (open with a finished garment), DELIVERED, CANCELLED; anything else = all. */
    @Transactional(readOnly = true)
    public StitchPageResponse list(Long outletId, String view, String search, int page) {
        String v = view == null ? "" : view.toUpperCase();
        boolean open = v.equals("OPEN") || v.equals("READY");
        Collection<StitchStatus> statuses =
                switch (v) {
                    case "OPEN", "READY" -> List.of(StitchStatus.OPEN);
                    case "DELIVERED" -> List.of(StitchStatus.DELIVERED);
                    case "CANCELLED" -> List.of(StitchStatus.CANCELLED);
                    default -> List.of(StitchStatus.values());
                };
        Sort sort =
                open
                        ? Sort.by(Sort.Order.asc("estimatedDeliveryDate"), Sort.Order.asc("id"))
                        : Sort.by(Sort.Order.desc("id"));
        Page<StitchOrder> p =
                orders.search(
                        outletId,
                        statuses,
                        "READY".equals(v),
                        search == null ? "" : search.trim(),
                        PageRequest.of(Math.max(0, page), 50, sort));
        return new StitchPageResponse(
                p.getContent().stream().map(this::response).toList(),
                p.getNumber(),
                p.getSize(),
                p.getTotalPages(),
                p.getTotalElements());
    }

    /** Exact receipt number (scan or typed), this outlet only. */
    @Transactional(readOnly = true)
    public StitchOrderResponse lookup(Long outletId, String code) {
        String c = code == null ? "" : code.trim();
        return response(
                orders.findByOrderNumberIgnoreCaseAndOutletId(c, outletId)
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "We couldn't find an order with that number")));
    }

    @Transactional(readOnly = true)
    public StitchOrderResponse get(Long outletId, Long id) {
        return response(load(outletId, id));
    }

    /** Orders with a garment due on the day that is not yet delivered. */
    @Transactional(readOnly = true)
    public List<StitchOrderResponse> due(Long outletId, LocalDate day) {
        return distinctOrders(items.openDueOn(outletId, day));
    }

    /** Orders with a garment past its date and not yet delivered, oldest first. */
    @Transactional(readOnly = true)
    public List<StitchOrderResponse> overdue(Long outletId) {
        return distinctOrders(items.openDueBefore(outletId, today()));
    }

    /** Next deliveries after today (up to 20 orders). */
    @Transactional(readOnly = true)
    public List<StitchOrderResponse> upcoming(Long outletId) {
        return distinctOrders(items.openDueAfter(outletId, today(), PageRequest.of(0, 60))).stream()
                .limit(20)
                .toList();
    }

    /** Calendar: orders with any garment (not cancelled) dated that day. */
    @Transactional(readOnly = true)
    public List<StitchOrderResponse> day(Long outletId, LocalDate day) {
        return distinctOrders(items.onDay(outletId, day));
    }

    /** The customer's earlier measurements at this outlet, newest first. */
    @Transactional(readOnly = true)
    public List<StitchMeasurementResponse> measurements(Long outletId, String mobile) {
        if (mobile == null || !mobile.trim().matches("[0-9]{10}")) return List.of();
        return items
                .measurementsFor(outletId, mobile.trim(), PageRequest.of(0, MEASUREMENT_HISTORY))
                .stream()
                .map(
                        i ->
                                new StitchMeasurementResponse(
                                        i.getId(),
                                        i.getGarment(),
                                        i.getMeasurements(),
                                        i.getMeasuredOn(),
                                        i.getOrder().getOrderNumber()))
                .toList();
    }

    /** Today's shop bills of the customer, offered as "fabric bought here today". */
    @Transactional(readOnly = true)
    public List<StitchFabricBillResponse> fabricBills(Long outletId, String mobile) {
        if (mobile == null || !mobile.trim().matches("[0-9]{10}")) return List.of();
        return bills
                .salesBillsSince(outletId, mobile.trim(), today().atStartOfDay(ZONE).toInstant())
                .stream()
                .map(
                        b ->
                                new StitchFabricBillResponse(
                                        b.getId(),
                                        b.getBillNumber(),
                                        b.getTotal(),
                                        summary(b),
                                        b.getCreatedAt()))
                .toList();
    }

    // ---------------------------------------------------------------- helpers

    private StitchOrder load(Long outletId, Long id) {
        return orders.findByIdAndOutletId(id, outletId)
                .orElseThrow(() -> new ResourceNotFoundException("Stitching order not found"));
    }

    private StitchOrder lock(Long outletId, Long id) {
        return orders.findForUpdate(id, outletId)
                .orElseThrow(() -> new ResourceNotFoundException("Stitching order not found"));
    }

    private static StitchOrder open(StitchOrder o) {
        if (o.getStatus() != StitchStatus.OPEN)
            throw new IllegalArgumentException(
                    "This order is already " + o.getStatus().name().toLowerCase());
        return o;
    }

    private static StitchItem item(StitchOrder o, Long itemId) {
        return o.getItems().stream()
                .filter(i -> i.getId().equals(itemId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Garment not found on this order"));
    }

    private static StitchItem openItem(StitchOrder o, Long itemId) {
        StitchItem i = item(o, itemId);
        if (!i.getStatus().isOpen())
            throw new IllegalArgumentException(
                    "\"" + i.getGarment() + "\" is already " + label(i.getStatus()).toLowerCase());
        return i;
    }

    /** A shop bill of this outlet and this customer, to link as the fabric. */
    private Bill fabricBill(Long outletId, String mobile, Long billId) {
        Bill b =
                bills.findByIdAndOutletId(billId, outletId)
                        .orElseThrow(() -> new ResourceNotFoundException("Fabric bill not found"));
        if (!b.getCustomerMobile().equals(mobile) || b.getModule() != OutletModule.SALES)
            throw new IllegalArgumentException("Pick a shop bill of this customer for the fabric");
        return b;
    }

    /** OWN unless the screen says IN_HOUSE ("In-house purchase"). */
    private static FabricSource fabricSource(String value) {
        if (value == null || value.isBlank()) return FabricSource.OWN;
        try {
            return FabricSource.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Choose the customer's own fabric or an in-house purchase");
        }
    }

    private static String fabricText(StitchOrder o) {
        if (o.getFabricSource() == FabricSource.OWN) return "customer's own";
        return o.getFabricBill() == null
                ? "in-house purchase"
                : "in-house purchase (bill " + o.getFabricBill().getBillNumber() + ")";
    }

    /** When were these measurements taken? Copied ones keep their original date (if unchanged); typed ones are today's. */
    private LocalDate measuredOn(Long outletId, String mobile, StitchItemRequest r, StitchItem current) {
        String text = blank(r.measurements());
        if (text == null) return null;
        if (r.copiedFromItemId() != null) {
            StitchItem src =
                    items.findById(r.copiedFromItemId())
                            .filter(s -> s.getOrder().getOutlet().getId().equals(outletId))
                            .filter(s -> s.getOrder().getCustomerMobile().equals(mobile))
                            .orElseThrow(
                                    () ->
                                            new ResourceNotFoundException(
                                                    "Previous measurements not found"));
            if (text.equals(src.getMeasurements())) return src.getMeasuredOn();
        }
        if (current != null && text.equals(current.getMeasurements())) return current.getMeasuredOn();
        return today();
    }

    /** While every garment still to bill has a price, advances may not exceed the order total. */
    private void checkAdvance(StitchOrder o, BigDecimal extra) {
        Money m = money(o);
        if (m.unpriced() == 0 && m.advancePaid().add(extra).compareTo(m.total()) > 0)
            throw new IllegalArgumentException(
                    "Advance cannot be more than the order total (" + rupees(m.total()) + ")");
    }

    /** OPEN until every garment is delivered or cancelled. */
    private static void closeIfDone(StitchOrder o) {
        if (o.getItems().stream().anyMatch(i -> i.getStatus().isOpen())) return;
        boolean delivered =
                o.getItems().stream().anyMatch(i -> i.getStatus() == StitchItemStatus.DELIVERED);
        o.setStatus(delivered ? StitchStatus.DELIVERED : StitchStatus.CANCELLED);
        if (delivered) o.setDeliveredAt(Instant.now());
    }

    /** Keeps the order-level date (used for sorting lists) on the next garment still to deliver. */
    private static void refreshNextDate(StitchOrder o) {
        o.update(nextDate(o), o.getNotes());
    }

    private static LocalDate nextDate(StitchOrder o) {
        return o.getItems().stream()
                .filter(i -> i.getStatus().isOpen())
                .map(StitchItem::getEstimatedDeliveryDate)
                .min(Comparator.naturalOrder())
                .orElseGet(
                        () ->
                                o.getItems().stream()
                                        .map(StitchItem::getEstimatedDeliveryDate)
                                        .filter(Objects::nonNull)
                                        .max(Comparator.naturalOrder())
                                        .orElse(o.getEstimatedDeliveryDate()));
    }

    private record Money(
            BigDecimal total,
            int unpriced,
            BigDecimal advancePaid,
            BigDecimal used,
            BigDecimal refunded,
            BigDecimal kept,
            List<StitchPayment> payments,
            List<Bill> bills) {
        BigDecimal available() {
            return advancePaid.subtract(used).subtract(refunded).subtract(kept);
        }
    }

    private Money money(StitchOrder o) {
        BigDecimal total = BigDecimal.ZERO;
        int unpriced = 0;
        Map<Long, Bill> billed = new LinkedHashMap<>();
        for (StitchItem i : o.getItems()) {
            if (i.getBill() != null) billed.putIfAbsent(i.getBill().getId(), i.getBill());
            if (i.getStatus() == StitchItemStatus.CANCELLED) continue;
            if (i.getAmount() == null) unpriced++;
            else total = total.add(i.getAmount());
        }
        List<StitchPayment> ps =
                o.getId() == null ? List.of() : payments.findByOrderIdOrderByIdAsc(o.getId());
        BigDecimal paid = BigDecimal.ZERO, refunded = BigDecimal.ZERO, kept = BigDecimal.ZERO;
        for (StitchPayment p : ps) {
            if (p.getKind() == StitchPaymentKind.ADVANCE) paid = paid.add(p.getAmount());
            else {
                refunded = refunded.add(p.getAmount());
                kept = kept.add(p.getKeptAmount());
            }
        }
        BigDecimal used =
                billed.values().stream()
                        .map(Bill::getAdvancePaid)
                        .reduce(BigDecimal.ZERO, BigDecimal::add);
        return new Money(
                total, unpriced, paid, used, refunded, kept, ps, new ArrayList<>(billed.values()));
    }

    private void logPrice(
            StitchOrder o, StitchItem i, String garment, BigDecimal from, BigDecimal to, LogActor a) {
        String msg =
                from == null
                        ? "Price of " + garment + ": added " + rupees(to)
                        : to == null
                                ? "Price of " + garment + ": removed (was " + rupees(from) + ")"
                                : "Price of " + garment + ": " + rupees(from) + " → " + rupees(to);
        log(
                o,
                i,
                StitchLogKind.EDIT,
                msg,
                from == null ? null : from.toPlainString(),
                to == null ? null : to.toPlainString(),
                a);
    }

    private void log(
            StitchOrder o,
            StitchItem item,
            StitchLogKind kind,
            String message,
            String from,
            String to,
            LogActor a) {
        logs.save(new StitchOrderLog(o, item, kind, message, from, to, a.user(), a.name()));
    }

    private List<StitchOrderResponse> distinctOrders(List<StitchItem> list) {
        Map<Long, StitchOrder> seen = new LinkedHashMap<>();
        list.forEach(i -> seen.putIfAbsent(i.getOrder().getId(), i.getOrder()));
        return seen.values().stream().map(this::response).toList();
    }

    private static String summary(Bill b) {
        return String.join(
                ", ",
                b.getItems().stream()
                        .map(
                                x ->
                                        x.getQuantity() > 1
                                                ? x.getItemName() + " × " + x.getQuantity()
                                                : x.getItemName())
                        .toList());
    }

    private static String label(StitchItemStatus s) {
        return switch (s) {
            case NOT_STARTED -> "Not started";
            case STARTED -> "Started";
            case FINISHED -> "Finished";
            case DELIVERED -> "Delivered";
            case CANCELLED -> "Cancelled";
        };
    }

    private static String count(int n, String word) {
        return n + " " + word + (n == 1 ? "" : "s");
    }

    private static boolean sameMoney(BigDecimal a, BigDecimal b) {
        return a == null ? b == null : b != null && a.compareTo(b) == 0;
    }

    private static BigDecimal money(BigDecimal v) {
        return v == null ? null : v.setScale(2, RoundingMode.HALF_UP);
    }

    private static String blank(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private static LocalDate today() {
        return LocalDate.now(ZONE);
    }

    private StitchOrderResponse response(StitchOrder o) {
        Money m = money(o);
        return new StitchOrderResponse(
                o.getId(),
                o.getOrderNumber(),
                o.getStatus().name(),
                o.getCustomerName(),
                o.getCustomerMobile(),
                nextDate(o),
                o.getNotes(),
                o.getCreatedAt(),
                o.getItems().stream()
                        .map(
                                i ->
                                        new StitchOrderResponse.Item(
                                                i.getId(),
                                                i.getGarment(),
                                                i.getMeasurements(),
                                                i.getNotes(),
                                                i.getAmount(),
                                                i.getStatus().name(),
                                                i.getEstimatedDeliveryDate(),
                                                i.getMeasuredOn(),
                                                i.getStartedAt(),
                                                i.getFinishedAt(),
                                                i.getDeliveredAt(),
                                                i.getCancelledAt(),
                                                i.getCancelReason(),
                                                i.getBill() == null
                                                        ? null
                                                        : i.getBill().getBillNumber()))
                        .toList(),
                m.total(),
                m.unpriced(),
                m.advancePaid(),
                m.used(),
                m.refunded(),
                m.kept(),
                m.available(),
                m.bills().stream().map(billService::toResponse).toList(),
                m.payments().stream()
                        .map(
                                p ->
                                        new StitchOrderResponse.Payment(
                                                p.getId(),
                                                p.getKind().name(),
                                                p.getAmount(),
                                                p.getKeptAmount(),
                                                p.getRefundNumber(),
                                                p.getReason(),
                                                p.getAuthorName(),
                                                p.getCreatedAt()))
                        .toList(),
                o.getFabricSource().name(),
                o.getFabricBill() == null
                        ? null
                        : new StitchOrderResponse.FabricBill(
                                o.getFabricBill().getId(),
                                o.getFabricBill().getBillNumber(),
                                o.getFabricBill().getTotal(),
                                summary(o.getFabricBill())));
    }
}
