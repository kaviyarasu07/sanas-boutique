package com.sanasboutique.backend.outlet.service;

import static com.sanasboutique.backend.common.DisplayDates.format;
import static com.sanasboutique.backend.common.DisplayMoney.rupees;

import com.sanasboutique.backend.catalog.entity.ServiceItem;
import com.sanasboutique.backend.catalog.exception.ResourceNotFoundException;
import com.sanasboutique.backend.catalog.repository.ServiceItemRepository;
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
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Jewellery rental module (docs/features/jewellery-rental-flow.md, v3). Every method takes the
 * caller's outlet id (from the JWT) and only touches that outlet's rentals, pieces and bills.
 *
 * - Book: pieces of the Jewellery rental module, checked free for the dates (stock and overlapping
 *   bookings, row-locked against double booking). Rent now = book for today + hand over at once.
 * - Hand over (today): remove / add pieces, set the return date; every piece is checked again; stock
 *   goes out; a no-amount delivery challan is made.
 * - Return (today): every piece given is checked OK / damaged / missing. Rent = price per day ×
 *   days × quantity, days = return date − take-away date (minimum 1; late = extra days, no fine),
 *   plus damage and missing charges, minus a discount. Stock: OK and damaged-not-for-repair come back;
 *   repair pieces wait in "Under repair"; missing pieces are written off. Bill PREFIX-R-000123.
 * - Pre-bookings not collected by their date are cancelled by the system at the outlet's login and
 *   when the module is opened (no scheduler).
 */
@Service
@Transactional
public class RentalService {
    private static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");
    static final String NOT_COLLECTED = "Not collected by the booked date";

    private final BookingRepository bookings;
    private final BookingLogRepository logs;
    private final ItemRepairRepository repairs;
    private final ServiceItemRepository items;
    private final OutletRepository outlets;
    private final OutletCustomerRepository customers;
    private final OutletServiceAssignmentService assignments;
    private final BookingService bookingService;
    private final BillService billService;
    /** Outlet id → the day its uncollected pre-bookings were last swept (the open-module check runs once a day). */
    private final Map<Long, LocalDate> sweptOn = new ConcurrentHashMap<>();

    public RentalService(
            BookingRepository bookings,
            BookingLogRepository logs,
            ItemRepairRepository repairs,
            ServiceItemRepository items,
            OutletRepository outlets,
            OutletCustomerRepository customers,
            OutletServiceAssignmentService assignments,
            BookingService bookingService,
            BillService billService) {
        this.bookings = bookings;
        this.logs = logs;
        this.repairs = repairs;
        this.items = items;
        this.outlets = outlets;
        this.customers = customers;
        this.assignments = assignments;
        this.bookingService = bookingService;
        this.billService = billService;
    }

    // ---------------------------------------------------------------- products and availability

    /** Rental pieces of this outlet (price per day as entered on the product screen). */
    @Transactional(readOnly = true)
    public List<RentalProductResponse> products(Long outletId, String search) {
        String q = search == null ? "" : search.trim().toLowerCase();
        return items.findActiveForOutletModule(outletId, OutletModule.RENTAL).stream()
                .filter(i -> assignments.isUsable(outletId, i))
                .filter(i -> q.isEmpty() || i.getName().toLowerCase().contains(q) || (i.getItemCode() != null && i.getItemCode().toLowerCase().contains(q)))
                .map(i -> new RentalProductResponse(i.getId(), i.getName(), i.getItemCode(), i.getService().getName(), i.getPrice(), i.getQuantity(), i.getReplacementValue()))
                .toList();
    }

    @Transactional(readOnly = true)
    public AvailabilityResponse availability(Long outletId, Long itemId, LocalDate from, LocalDate to, int quantity) {
        if (from == null || to == null || to.isBefore(from)) throw new IllegalArgumentException("Choose a valid date range");
        return bookingService.availability(outletId, rentalItem(outletId, itemId), from, to, Math.max(1, quantity), null);
    }

    // ---------------------------------------------------------------- book, rent now

    public RentalBookingResponse book(Long outletId, RentalBookRequest r, LogActor a) {
        LocalDate start = r.startDate() == null ? today() : r.startDate();
        if (start.isBefore(today())) throw new IllegalArgumentException("The take-away date cannot be in the past");
        return response(create(outletId, r, start, a));
    }

    /** Book for today and hand over at once (walk-in rental). */
    public RentalBookingResponse rentNow(Long outletId, RentalBookRequest r, LogActor a) {
        Booking b = create(outletId, r, today(), a);
        handOver(b, outletId, r.returnDate(), List.of(), List.of(), a);
        return response(b);
    }

    private Booking create(Long outletId, RentalBookRequest r, LocalDate start, LogActor a) {
        Outlet outlet = outlet(outletId);
        LocalDate end = r.returnDate();
        if (end.isBefore(start)) throw new IllegalArgumentException("The return date cannot be before the take-away date");
        Map<ServiceItem, Integer> lines = lockAndCheck(outletId, merge(r.lines()), start, end, null);
        OutletCustomer customer = customer(outlet, r.customerMobile(), r.customerName());
        Booking b = new Booking(outlet, customer, BookingKind.RENTAL, start, null, end, blank(r.notes()));
        lines.forEach((item, qty) -> b.getItems().add(new BookingItem(b, item, qty)));
        Booking saved = bookings.saveAndFlush(b);
        saved.setBookingNumber(BillService.outletPrefix(outlet) + "-BK-" + String.format("%06d", saved.getId()));
        log(saved, BookingLogKind.CREATED, "Booked " + piecesText(saved) + " · " + format(start) + " → " + format(end) + " · estimate " + rupees(estimate(saved)), a);
        return saved;
    }

    // ---------------------------------------------------------------- hand over

    /** The customer takes the pieces today: remove / add pieces, set the return date, issue the challan. */
    public RentalBookingResponse handOver(Long outletId, Long id, RentalHandOverRequest r, LogActor a) {
        Booking b = lock(outletId, id);
        if (b.getStatus() != BookingStatus.BOOKED) throw new IllegalArgumentException("This booking is already " + statusWord(b));
        handOver(b, outletId, r.returnDate(), r.removeItemIds() == null ? List.of() : r.removeItemIds(), r.addItems() == null ? List.of() : r.addItems(), a);
        return response(b);
    }

    private void handOver(Booking b, Long outletId, LocalDate returnDate, List<Long> remove, List<RentalLine> add, LogActor a) {
        LocalDate today = today();
        if (returnDate.isBefore(today)) throw new IllegalArgumentException("The return date cannot be before today");
        List<String> removed = new ArrayList<>(), added = new ArrayList<>();
        for (Long itemId : new LinkedHashSet<>(remove)) {
            BookingItem bi = bookingItem(b, itemId);
            removed.add(bi.getServiceItem().getName());
            b.getItems().remove(bi);
        }
        Map<Long, Integer> extra = merge(add);
        for (var e : extra.entrySet()) {
            ServiceItem item = rentalItem(outletId, e.getKey());
            Optional<BookingItem> existing = b.getItems().stream().filter(x -> x.getServiceItem().getId().equals(item.getId())).findFirst();
            if (existing.isPresent()) existing.get().addAtHandOver(e.getValue());
            else {
                BookingItem bi = new BookingItem(b, item, 0);
                bi.addAtHandOver(e.getValue());
                b.getItems().add(bi);
            }
            added.add(e.getValue() > 1 ? item.getName() + " × " + e.getValue() : item.getName());
        }
        if (b.getItems().isEmpty()) throw new IllegalArgumentException("Keep at least one piece to hand over");

        // Every piece is checked again for [today, return date] (customer may come early or keep it longer), then goes out of stock.
        Map<Long, Integer> wanted = new TreeMap<>();
        b.getItems().forEach(bi -> wanted.merge(bi.getServiceItem().getId(), bi.getQuantity(), Integer::sum));
        lockAndCheck(outletId, wanted, today, returnDate, b.getId());
        List<BillService.BookingLine> lines = new ArrayList<>();
        for (BookingItem bi : b.getItems()) {
            billService.adjustStock(outletId, bi.getServiceItem(), -bi.getQuantity());
            lines.add(new BillService.BookingLine(bi.getServiceItem(), bi.getQuantity(), BillService.CHALLAN_LABEL, BigDecimal.ZERO));
        }
        b.setExpectedReturnDate(returnDate);
        Bill challan = billService.createForBooking(b.getOutlet(), b.getCustomer(), null, lines);
        challan.setBillType(BillType.CHALLAN);
        challan.getItems().forEach(i -> i.setLineType(BillLineType.CHALLAN));
        billService.fileUnder(challan, OutletModule.RENTAL, "DC");
        b.setChallanBill(challan);
        b.setHandedOverOn(today);
        b.setStatus(BookingStatus.HANDED_OVER);
        log(b, BookingLogKind.HANDED_OVER,
                "Handed over " + piecesText(b) + " · return " + format(returnDate) + " · estimate " + rupees(estimate(b)) + " · challan " + challan.getBillNumber()
                        + (added.isEmpty() ? "" : " · added " + String.join(", ", added))
                        + (removed.isEmpty() ? "" : " · removed " + String.join(", ", removed)),
                a);
    }

    // ---------------------------------------------------------------- return and bill

    /** Today's return: every piece given is checked; rent for the days, damage and missing charges, discount. */
    public RentalBookingResponse returnRental(Long outletId, Long id, RentalReturnRequest r, LogActor a) {
        Booking b = lock(outletId, id);
        if (b.getStatus() != BookingStatus.HANDED_OVER) throw new IllegalArgumentException("Only a rental that is with the customer can be returned");
        LocalDate today = today();
        int days = days(b.getHandedOverOn(), today);
        Map<Long, RentalReturnRequest.Piece> checks = new HashMap<>();
        for (RentalReturnRequest.Piece p : r.items())
            if (checks.put(p.itemId(), p) != null) throw new IllegalArgumentException("Each piece can be checked only once");
        if (checks.size() != b.getItems().size() || b.getItems().stream().anyMatch(bi -> !checks.containsKey(bi.getServiceItem().getId())))
            throw new IllegalArgumentException("Check every piece that was given before making the bill");

        List<BillService.BookingLine> lines = new ArrayList<>();
        List<BillLineType> types = new ArrayList<>();
        BigDecimal damageTotal = BigDecimal.ZERO, missingTotal = BigDecimal.ZERO;
        Instant now = Instant.now();
        List<String> repairNotes = new ArrayList<>();
        for (BookingItem bi : b.getItems()) {
            ServiceItem item = items.findByIdForUpdate(bi.getServiceItem().getId()).orElseThrow();
            RentalReturnRequest.Piece p = checks.get(item.getId());
            if (p.okQty() + p.damagedQty() + p.missingQty() != bi.getQuantity())
                throw new IllegalArgumentException("\"" + item.getName() + "\": " + bi.getQuantity() + " given, but OK + damaged + missing = " + (p.okQty() + p.damagedQty() + p.missingQty()));
            if (p.repairQty() > p.damagedQty()) throw new IllegalArgumentException("\"" + item.getName() + "\": more sent for repair than damaged");
            if (p.damagedQty() > 0 && p.damageCharge() == null) throw new IllegalArgumentException("Enter the damage charge for \"" + item.getName() + "\" (0 to waive it)");
            if (p.missingQty() > 0 && p.missingCharge() == null) throw new IllegalArgumentException("Enter the missing charge for \"" + item.getName() + "\" (0 to waive it)");
            BigDecimal damage = p.damagedQty() > 0 ? money(p.damageCharge()) : null;
            BigDecimal missing = p.missingQty() > 0 ? money(p.missingCharge()) : null;
            String note = blank(p.damageNote());
            bi.recordReturn(p.okQty(), p.damagedQty(), p.repairQty(), p.missingQty(), damage, p.damagedQty() > 0 ? note : null, missing);

            // Stock: OK and damaged-not-for-repair come back; repair pieces wait; missing pieces are written off.
            billService.adjustStock(outletId, item, p.okQty() + p.damagedQty() - p.repairQty());
            if (p.repairQty() > 0) {
                repairs.save(new ItemRepair(b.getOutlet(), item, b, p.repairQty(), note, today));
                repairNotes.add(item.getName() + (p.repairQty() > 1 ? " × " + p.repairQty() : ""));
            }

            int q = bi.getQuantity();
            lines.add(new BillService.BookingLine(item, days * q, " (rental, " + days + (days == 1 ? " day" : " days") + (q > 1 ? " × " + q + " pcs" : "") + ")", item.getPrice()));
            types.add(BillLineType.RENTAL);
            if (damage != null && damage.signum() > 0) {
                lines.add(new BillService.BookingLine(item, 1, " – damage" + (p.damagedQty() > 1 ? " × " + p.damagedQty() : "") + (note != null ? " (" + note + ")" : ""), damage));
                types.add(BillLineType.DAMAGE);
                damageTotal = damageTotal.add(damage);
            }
            if (missing != null && missing.signum() > 0) {
                lines.add(new BillService.BookingLine(item, 1, " – missing" + (p.missingQty() > 1 ? " × " + p.missingQty() : ""), missing));
                types.add(BillLineType.MISSING);
                missingTotal = missingTotal.add(missing);
            }
        }
        BigDecimal subtotal = lines.stream().map(l -> l.unitPrice().multiply(BigDecimal.valueOf(l.quantity()))).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal discount = money(r.discount());
        if (discount.compareTo(subtotal) > 0) throw new IllegalArgumentException("Discount cannot be more than the bill amount");

        Bill bill = billService.createForBooking(b.getOutlet(), b.getCustomer(), discount, lines);
        for (int n = 0; n < types.size(); n++) bill.getItems().get(n).setLineType(types.get(n));
        billService.fileUnder(bill, OutletModule.RENTAL, "R");
        b.setReturnedOn(today);
        b.setBill(bill);
        b.setStatus(BookingStatus.COMPLETED);
        log(b, BookingLogKind.RETURNED,
                "Returned · " + days + (days == 1 ? " day" : " days") + " · bill " + bill.getBillNumber() + " · " + rupees(bill.getTotal())
                        + (damageTotal.signum() > 0 ? " · damage " + rupees(damageTotal) : "")
                        + (missingTotal.signum() > 0 ? " · missing " + rupees(missingTotal) : ""),
                a);
        if (!repairNotes.isEmpty()) log(b, BookingLogKind.REPAIR, "Sent for repair: " + String.join(", ", repairNotes), a);
        return response(b);
    }

    // ---------------------------------------------------------------- cancel, cancel & reschedule

    public RentalBookingResponse cancel(Long outletId, Long id, ParlourCancelRequest r, LogActor a) {
        Booking b = openBooking(lock(outletId, id));
        String reason = r.reason().trim() + (blank(r.comment()) != null ? " · " + r.comment().trim() : "");
        b.cancel(reason, false, Instant.now());
        log(b, BookingLogKind.CANCELLED, "Cancelled: " + reason, a);
        return response(b);
    }

    /** Cancel this pre-booking and book the same pieces for new dates; returns the new booking. */
    public RentalBookingResponse cancelAndReschedule(Long outletId, Long id, RentalRescheduleRequest r, LogActor a) {
        Booking old = openBooking(lock(outletId, id));
        if (r.startDate().isBefore(today())) throw new IllegalArgumentException("The take-away date cannot be in the past");
        if (r.returnDate().isBefore(r.startDate())) throw new IllegalArgumentException("The return date cannot be before the take-away date");
        Map<Long, Integer> wanted = new TreeMap<>();
        old.getItems().forEach(bi -> wanted.merge(bi.getServiceItem().getId(), bi.getQuantity(), Integer::sum));
        Map<ServiceItem, Integer> lines = lockAndCheck(outletId, wanted, r.startDate(), r.returnDate(), old.getId());
        Booking b = new Booking(old.getOutlet(), old.getCustomer(), BookingKind.RENTAL, r.startDate(), null, r.returnDate(), old.getNotes());
        lines.forEach((item, qty) -> b.getItems().add(new BookingItem(b, item, qty)));
        Booking next = bookings.saveAndFlush(b);
        next.setBookingNumber(BillService.outletPrefix(old.getOutlet()) + "-BK-" + String.format("%06d", next.getId()));
        String to = "Rescheduled to " + format(r.startDate()) + " → " + format(r.returnDate()) + " · " + next.getBookingNumber();
        old.cancelAndReschedule(next, to, Instant.now());
        log(old, BookingLogKind.RESCHEDULED, to, a);
        log(next, BookingLogKind.CREATED, "Booked " + piecesText(next) + " · " + format(r.startDate()) + " → " + format(r.returnDate()) + " (rescheduled from " + old.getBookingNumber() + ")", a);
        return response(next);
    }

    // ---------------------------------------------------------------- lists, lookups, dashboard

    public RentalDashboardResponse dashboard(Long outletId) {
        ensureSwept(outletId);
        LocalDate today = today();
        return new RentalDashboardResponse(
                bookings.rentalsToCollect(outletId, today).stream().map(this::response).toList(),
                bookings.rentalsDueBack(outletId, today).stream().map(this::response).toList(),
                bookings.rentalsLate(outletId, today).stream().map(this::response).toList(),
                repairs.countByOutletIdAndStatus(outletId, RepairStatus.UNDER_REPAIR));
    }

    /** Rentals taking place on a day: taken away, handed over, due back or returned that day. */
    public List<RentalBookingResponse> day(Long outletId, LocalDate day) {
        ensureSwept(outletId);
        return bookings.forDay(outletId, day).stream().filter(b -> b.getKind() == BookingKind.RENTAL).map(this::response).toList();
    }

    /** status: BOOKED, WITH_CUSTOMER, RETURNED, CANCELLED (by hand), NOT_COLLECTED (by the system); anything else = all. */
    public RentalBookingPage search(Long outletId, String status, String search, int page) {
        ensureSwept(outletId);
        String s = status == null ? "" : status.toUpperCase();
        Collection<BookingStatus> statuses =
                switch (s) {
                    case "BOOKED" -> List.of(BookingStatus.BOOKED);
                    case "WITH_CUSTOMER" -> List.of(BookingStatus.HANDED_OVER);
                    case "RETURNED" -> List.of(BookingStatus.COMPLETED);
                    case "CANCELLED", "NOT_COLLECTED" -> List.of(BookingStatus.CANCELLED);
                    default -> List.of(BookingStatus.values());
                };
        Boolean auto = s.equals("NOT_COLLECTED") ? Boolean.TRUE : s.equals("CANCELLED") ? Boolean.FALSE : null;
        Sort sort = s.equals("BOOKED") || s.equals("WITH_CUSTOMER")
                ? Sort.by(Sort.Order.asc("startDate"), Sort.Order.asc("id"))
                : Sort.by(Sort.Order.desc("startDate"), Sort.Order.desc("id"));
        Page<Booking> p = bookings.searchRentals(outletId, statuses, auto, search == null ? "" : search.trim(), PageRequest.of(Math.max(0, page), 50, sort));
        return new RentalBookingPage(p.getContent().stream().map(this::response).toList(), p.getNumber(), p.getSize(), p.getTotalPages(), p.getTotalElements());
    }

    /** Booking number (slip) or challan number (scan). */
    public RentalBookingResponse lookup(Long outletId, String code) {
        ensureSwept(outletId);
        String c = code == null ? "" : code.trim();
        return response(
                bookings.findByBookingNumberIgnoreCaseAndOutletId(c, outletId)
                        .or(() -> bookings.findByChallanNumber(outletId, c))
                        .filter(b -> b.getKind() == BookingKind.RENTAL)
                        .orElseThrow(() -> new ResourceNotFoundException("We couldn't find a booking with that number")));
    }

    public RentalBookingResponse get(Long outletId, Long id) {
        ensureSwept(outletId);
        return response(rental(outletId, id));
    }

    @Transactional(readOnly = true)
    public List<BookingLogResponse> log(Long outletId, Long id) {
        Booking b = rental(outletId, id);
        return logs.findByBookingIdOrderByIdAsc(b.getId()).stream()
                .map(l -> new BookingLogResponse(l.getId(), l.getKind().name(), l.getMessage(), l.getAuthorName(), l.getCreatedAt()))
                .toList();
    }

    public List<BookingLogResponse> comment(Long outletId, Long id, CommentRequest r, LogActor a) {
        Booking b = rental(outletId, id);
        String text = blank(r.text());
        if (text == null) throw new IllegalArgumentException("Write a comment first");
        log(b, BookingLogKind.COMMENT, text, a);
        return log(outletId, id);
    }

    @Transactional(readOnly = true)
    public BillPageResponse bills(Long outletId, String search, int page, String from, String to) {
        return billService.modulePage(outletId, OutletModule.RENTAL, search, page, from, to);
    }

    // ---------------------------------------------------------------- repairs

    @Transactional(readOnly = true)
    public List<RepairResponse> repairs(Long outletId) {
        return repairs.findByOutletIdAndStatusOrderBySentOnAscIdAsc(outletId, RepairStatus.UNDER_REPAIR).stream().map(RentalService::repair).toList();
    }

    /** The repairer brought the piece back: it goes back into stock and can be rented again. */
    public RepairResponse backInStock(Long outletId, Long repairId, LogActor a) {
        ItemRepair r = repairs.findByIdAndOutletId(repairId, outletId).orElseThrow(() -> new ResourceNotFoundException("Repair not found"));
        if (r.getStatus() != RepairStatus.UNDER_REPAIR) throw new IllegalArgumentException("This piece is already back in stock");
        ServiceItem item = items.findByIdForUpdate(r.getServiceItem().getId()).orElseThrow();
        billService.adjustStock(outletId, item, r.getQuantity());
        r.markBackInStock(today());
        if (r.getBooking() != null)
            log(r.getBooking(), BookingLogKind.REPAIR, item.getName() + (r.getQuantity() > 1 ? " × " + r.getQuantity() : "") + " repaired, back in stock", a);
        return repair(r);
    }

    // ---------------------------------------------------------------- system cancel ("Not collected by the booked date")

    /** Cancels this outlet's pre-bookings whose take-away date has passed. Safe to repeat; returns how many. */
    public int sweepOutlet(Long outletId) {
        LocalDate today = today();
        Instant now = Instant.now();
        List<Booking> stale = bookings.staleRentals(outletId, today);
        for (Booking b : stale) {
            b.cancel(NOT_COLLECTED, true, now);
            log(b, BookingLogKind.AUTO_CANCELLED, "Cancelled by the system: not collected by " + format(b.getStartDate()), LogActor.SYSTEM);
        }
        sweptOn.put(outletId, today);
        return stale.size();
    }

    private void ensureSwept(Long outletId) {
        if (!today().equals(sweptOn.get(outletId))) sweepOutlet(outletId);
    }

    // ---------------------------------------------------------------- helpers

    /** Lock the pieces (in id order, so two requests never wait on each other) and check each is free for [from, to]. */
    private Map<ServiceItem, Integer> lockAndCheck(Long outletId, Map<Long, Integer> wanted, LocalDate from, LocalDate to, Long ignoreBookingId) {
        Map<ServiceItem, Integer> out = new LinkedHashMap<>();
        for (var e : new TreeMap<>(wanted).entrySet()) {
            ServiceItem item = items.findByIdForUpdate(e.getKey()).filter(i -> outletId.equals(i.getOutletId()))
                    .orElseThrow(() -> new ResourceNotFoundException("Product not found"));
            checkRental(outletId, item);
            AvailabilityResponse av = bookingService.availability(outletId, item, from, to, e.getValue(), ignoreBookingId);
            if (!av.available()) throw new IllegalArgumentException("\"" + item.getName() + "\": " + av.reason());
            out.put(item, e.getValue());
        }
        return out;
    }

    private ServiceItem rentalItem(Long outletId, Long itemId) {
        ServiceItem i = items.findByIdAndOutletId(itemId, outletId).orElseThrow(() -> new ResourceNotFoundException("Product not found"));
        checkRental(outletId, i);
        return i;
    }

    private void checkRental(Long outletId, ServiceItem i) {
        if (i.getService().getModule() != OutletModule.RENTAL) throw new IllegalArgumentException("\"" + i.getName() + "\" is not a jewellery rental piece");
        if (!assignments.isUsable(outletId, i)) throw new IllegalArgumentException("\"" + i.getName() + "\" is not available at this outlet");
    }

    private static Map<Long, Integer> merge(List<RentalLine> lines) {
        Map<Long, Integer> m = new TreeMap<>();
        lines.forEach(l -> m.merge(l.itemId(), l.quantity(), Integer::sum));
        return m;
    }

    private static BookingItem bookingItem(Booking b, Long itemId) {
        return b.getItems().stream().filter(x -> x.getServiceItem().getId().equals(itemId)).findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Piece not found on this booking"));
    }

    private OutletCustomer customer(Outlet outlet, String mobile, String name) {
        String m = mobile.trim();
        if (!m.matches("[0-9]{10}")) throw new IllegalArgumentException("Mobile number must be exactly 10 digits");
        OutletCustomer c = customers.findByOutletIdAndMobileNumber(outlet.getId(), m).orElseGet(() -> customers.save(new OutletCustomer(outlet, m, name.trim())));
        c.setName(name.trim());
        return c;
    }

    private Outlet outlet(Long outletId) {
        return outlets.findById(outletId).orElseThrow(() -> new ResourceNotFoundException("Outlet not found"));
    }

    private Booking rental(Long outletId, Long id) {
        return bookings.findByIdAndOutletId(id, outletId).filter(b -> b.getKind() == BookingKind.RENTAL)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));
    }

    private Booking lock(Long outletId, Long id) {
        return bookings.findForUpdate(id, outletId).filter(b -> b.getKind() == BookingKind.RENTAL)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));
    }

    private static Booking openBooking(Booking b) {
        if (b.getStatus() != BookingStatus.BOOKED) throw new IllegalArgumentException("Only a pre-booking that is not collected yet can be changed (this one is " + statusWord(b) + ")");
        return b;
    }

    private static String statusWord(Booking b) {
        return switch (b.getStatus()) {
            case HANDED_OVER -> "with the customer";
            case COMPLETED -> "returned";
            case CANCELLED -> "cancelled";
            default -> "booked";
        };
    }

    private void log(Booking b, BookingLogKind kind, String message, LogActor a) {
        logs.save(new BookingLog(b, kind, message, a.user(), a.name()));
    }

    /** Days charged: return date − take-away date, at least 1 (take on 14th, return on 16th = 2 days). */
    static int days(LocalDate from, LocalDate to) {
        return (int) Math.max(1, ChronoUnit.DAYS.between(from, to));
    }

    /** Planned days, or actual once returned; a rental still out past its date counts up to today. */
    private static int daysOf(Booking b) {
        LocalDate from = b.getHandedOverOn() != null ? b.getHandedOverOn() : b.getStartDate();
        LocalDate to = b.getReturnedOn() != null ? b.getReturnedOn() : b.getExpectedReturnDate();
        if (b.getStatus() == BookingStatus.HANDED_OVER && today().isAfter(to)) to = today();
        return days(from, to);
    }

    private static BigDecimal estimate(Booking b) {
        BigDecimal perDay = b.getItems().stream().map(i -> i.getServiceItem().getPrice().multiply(BigDecimal.valueOf(i.getQuantity()))).reduce(BigDecimal.ZERO, BigDecimal::add);
        return perDay.multiply(BigDecimal.valueOf(daysOf(b)));
    }

    private static String piecesText(Booking b) {
        int n = b.getItems().stream().mapToInt(BookingItem::getQuantity).sum();
        return n + (n == 1 ? " piece" : " pieces");
    }

    private static BigDecimal money(BigDecimal v) {
        return (v == null ? BigDecimal.ZERO : v).setScale(2, RoundingMode.HALF_UP);
    }

    private static String blank(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private static LocalDate today() {
        return LocalDate.now(ZONE);
    }

    private static RepairResponse repair(ItemRepair r) {
        return new RepairResponse(r.getId(), r.getServiceItem().getId(), r.getServiceItem().getName(), r.getServiceItem().getItemCode(), r.getQuantity(), r.getNote(), r.getSentOn(),
                r.getBooking() == null ? null : r.getBooking().getBookingNumber(), r.getBooking() == null ? null : r.getBooking().getCustomerName());
    }

    private RentalBookingResponse response(Booking b) {
        String status = switch (b.getStatus()) {
            case HANDED_OVER -> "WITH_CUSTOMER";
            case COMPLETED -> "RETURNED";
            default -> b.getStatus().name();
        };
        return new RentalBookingResponse(
                b.getId(), b.getBookingNumber(), status, b.isAutoCancelled(), b.getCustomerName(), b.getCustomerMobile(),
                b.getStartDate(), b.getExpectedReturnDate(), b.getHandedOverOn(), b.getReturnedOn(), b.getNotes(), b.getCreatedAt(),
                b.getItems().stream().map(i -> {
                    ServiceItem s = i.getServiceItem();
                    return new RentalBookingResponse.Item(s.getId(), s.getName(), s.getItemCode(), s.getPrice(), i.getQuantity(), i.getAddedQty(),
                            i.getOkQty(), i.getDamagedQty(), i.getRepairQty(), i.getMissingQty(), i.getDamageCharge(), i.getDamageNote(), i.getMissingCharge(), s.getReplacementValue());
                }).toList(),
                daysOf(b), estimate(b),
                b.getChallanBill() == null ? null : billService.toResponse(b.getChallanBill()),
                b.getBill() == null ? null : billService.toResponse(b.getBill()),
                b.getCancelReason(),
                b.getRescheduledTo() == null ? null : b.getRescheduledTo().getBookingNumber(),
                bookings.findByRescheduledToId(b.getId()).map(Booking::getBookingNumber).orElse(null));
    }
}
