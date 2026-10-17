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
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Parlour module (docs/features/parlour.md). Every method takes the caller's outlet id (from the
 * JWT) and only touches that outlet's appointments and bills.
 *
 * - Walk-in bill or the bill of a booked customer on the day (services may be added/removed).
 *   Prices are always the service's own; only a discount can be given. Bills are PREFIX-P-000123.
 * - Appointments: date + time required, no slot limit. They end Done (billed), Cancelled by hand,
 *   Cancelled & rescheduled (a new linked booking), or cancelled by the system.
 * - System cancel ("Not done by end of day"): the 6:00 AM job, and the same sweep on first use of
 *   the day, so staff never see an earlier day's booking as still open.
 */
@Service
@Transactional
public class ParlourService {
    private static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");
    static final String NOT_DONE = "Not done by end of day";
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("hh:mm a", Locale.ENGLISH);

    private final BookingRepository bookings;
    private final BookingLogRepository logs;
    private final ServiceItemRepository items;
    private final OutletRepository outlets;
    private final OutletCustomerRepository customers;
    private final OutletServiceAssignmentService assignments;
    private final BillService billService;
    /** Outlet id → the day its leftovers were last swept, so the first-use sweep runs once a day per outlet. */
    private final Map<Long, LocalDate> sweptOn = new ConcurrentHashMap<>();

    public ParlourService(
            BookingRepository bookings,
            BookingLogRepository logs,
            ServiceItemRepository items,
            OutletRepository outlets,
            OutletCustomerRepository customers,
            OutletServiceAssignmentService assignments,
            BillService billService) {
        this.bookings = bookings;
        this.logs = logs;
        this.items = items;
        this.outlets = outlets;
        this.customers = customers;
        this.assignments = assignments;
        this.billService = billService;
    }

    // ---------------------------------------------------------------- services and bills

    /** Parlour services enabled for this outlet, grouped by service, for the button grid. */
    @Transactional(readOnly = true)
    public List<ParlourServiceGroup> services(Long outletId) {
        Map<Long, List<ServiceItem>> grouped = new LinkedHashMap<>();
        for (ServiceItem i : items.findActiveForOutletModule(outletId, OutletModule.PARLOUR))
            if (assignments.isUsable(outletId, i))
                grouped.computeIfAbsent(i.getService().getId(), k -> new ArrayList<>()).add(i);
        return grouped.values().stream()
                .map(
                        list ->
                                new ParlourServiceGroup(
                                        list.get(0).getService().getId(),
                                        list.get(0).getService().getName(),
                                        list.stream()
                                                .map(
                                                        i ->
                                                                new ParlourServiceGroup.Item(
                                                                        i.getId(),
                                                                        i.getName(),
                                                                        i.getPrice(),
                                                                        i.getItemCode()))
                                                .toList()))
                .toList();
    }

    /** Walk-in bill, or the bill of today's booked customer (bookingId). Fixed prices, discount only. */
    public BillResponse bill(Long outletId, ParlourBillRequest r, LogActor a) {
        Outlet outlet = outlet(outletId);
        Map<ServiceItem, Integer> lines = resolve(outletId, r.lines());
        Booking booking = null;
        OutletCustomer customer;
        if (r.bookingId() != null) {
            booking = lockAppointment(outletId, r.bookingId());
            if (booking.getStatus() != BookingStatus.BOOKED)
                throw new IllegalArgumentException("This booking is already " + statusWord(booking));
            if (!booking.getStartDate().equals(today()))
                throw new IllegalArgumentException(
                        "This booking is for "
                                + format(booking.getStartDate())
                                + ". Bill it on that day, or cancel & reschedule it to today.");
            customer = booking.getCustomer();
        } else customer = customer(outlet, r.customerMobile(), r.customerName());

        BigDecimal subtotal = BigDecimal.ZERO;
        for (var e : lines.entrySet())
            subtotal = subtotal.add(e.getKey().getPrice().multiply(BigDecimal.valueOf(e.getValue())));
        BigDecimal discount = money(r.discount());
        if (discount.compareTo(subtotal) > 0)
            throw new IllegalArgumentException("Discount cannot be more than the bill amount");

        Bill bill =
                billService.createForBooking(
                        outlet,
                        customer,
                        discount,
                        lines.entrySet().stream()
                                .map(e -> new BillService.BookingLine(e.getKey(), e.getValue(), ""))
                                .toList());
        billService.fileUnder(bill, OutletModule.PARLOUR, "P");

        if (booking != null) {
            booking.setBill(bill);
            booking.setStatus(BookingStatus.COMPLETED);
            log(booking, BookingLogKind.DONE, "Billed " + bill.getBillNumber() + " · " + rupees(bill.getTotal()) + changes(booking, lines), a);
        }
        return billService.toResponse(bill);
    }

    @Transactional(readOnly = true)
    public BillPageResponse bills(Long outletId, String search, int page, String from, String to) {
        return billService.modulePage(outletId, OutletModule.PARLOUR, search, page, from, to);
    }

    // ---------------------------------------------------------------- appointments

    public ParlourAppointmentResponse book(Long outletId, ParlourAppointmentRequest r, LogActor a) {
        Outlet outlet = outlet(outletId);
        if (r.date().isBefore(today())) throw new IllegalArgumentException("Date cannot be in the past");
        Map<ServiceItem, Integer> lines = resolve(outletId, r.lines());
        OutletCustomer customer = customer(outlet, r.customerMobile(), r.customerName());
        Booking b = create(outlet, customer, r.date(), r.time(), blank(r.notes()), lines);
        log(b, BookingLogKind.CREATED, "Booked for " + when(b) + " · " + servicesText(b) + " · estimate " + rupees(estimate(b)), a);
        return response(b);
    }

    /** One day's appointments in time order. Runs the first-use sweep first. */
    public List<ParlourAppointmentResponse> day(Long outletId, LocalDate day) {
        ensureSwept(outletId);
        return bookings.appointmentsOn(outletId, day).stream().map(this::response).toList();
    }

    /** status: BOOKED, DONE, CANCELLED (by hand), NOT_DONE (by the system); anything else = all. */
    public ParlourAppointmentPage search(Long outletId, String status, String search, int page) {
        ensureSwept(outletId);
        String s = status == null ? "" : status.toUpperCase();
        Collection<BookingStatus> statuses =
                switch (s) {
                    case "BOOKED" -> List.of(BookingStatus.BOOKED);
                    case "DONE" -> List.of(BookingStatus.COMPLETED);
                    case "CANCELLED", "NOT_DONE" -> List.of(BookingStatus.CANCELLED);
                    default -> List.of(BookingStatus.values());
                };
        Boolean auto = s.equals("NOT_DONE") ? Boolean.TRUE : s.equals("CANCELLED") ? Boolean.FALSE : null;
        Sort sort =
                s.equals("BOOKED")
                        ? Sort.by(Sort.Order.asc("startDate"), Sort.Order.asc("startTime"), Sort.Order.asc("id"))
                        : Sort.by(Sort.Order.desc("startDate"), Sort.Order.desc("startTime"), Sort.Order.desc("id"));
        Page<Booking> p =
                bookings.searchAppointments(
                        outletId, statuses, auto, search == null ? "" : search.trim(), PageRequest.of(Math.max(0, page), 50, sort));
        return new ParlourAppointmentPage(
                p.getContent().stream().map(this::response).toList(),
                p.getNumber(),
                p.getSize(),
                p.getTotalPages(),
                p.getTotalElements());
    }

    /** Exact booking number (scan or typed). */
    public ParlourAppointmentResponse lookup(Long outletId, String code) {
        ensureSwept(outletId);
        Booking b =
                bookings.findByBookingNumberIgnoreCaseAndOutletId(code == null ? "" : code.trim(), outletId)
                        .filter(x -> x.getKind() == BookingKind.APPOINTMENT)
                        .orElseThrow(() -> new ResourceNotFoundException("We couldn't find a booking with that number"));
        return response(b);
    }

    public ParlourAppointmentResponse get(Long outletId, Long id) {
        ensureSwept(outletId);
        return response(appointment(outletId, id));
    }

    public ParlourAppointmentResponse cancel(Long outletId, Long id, ParlourCancelRequest r, LogActor a) {
        Booking b = openAppointment(lockAppointment(outletId, id));
        String reason = r.reason().trim() + (blank(r.comment()) != null ? " · " + r.comment().trim() : "");
        b.cancel(reason, false, Instant.now());
        log(b, BookingLogKind.CANCELLED, "Cancelled: " + reason, a);
        return response(b);
    }

    /** Cancel this booking and book the same services for the new day and time; returns the new booking. */
    public ParlourAppointmentResponse cancelAndReschedule(
            Long outletId, Long id, ParlourRescheduleRequest r, LogActor a) {
        Booking old = openAppointment(lockAppointment(outletId, id));
        if (r.date().isBefore(today())) throw new IllegalArgumentException("Date cannot be in the past");
        Map<ServiceItem, Integer> lines = new LinkedHashMap<>();
        old.getItems().forEach(i -> lines.merge(i.getServiceItem(), i.getQuantity(), Integer::sum));
        Booking next = create(old.getOutlet(), old.getCustomer(), r.date(), r.time(), old.getNotes(), lines);
        String to = "Rescheduled to " + when(next) + " · " + next.getBookingNumber();
        old.cancelAndReschedule(next, to, Instant.now());
        log(old, BookingLogKind.RESCHEDULED, to, a);
        log(next, BookingLogKind.CREATED, "Booked for " + when(next) + " (rescheduled from " + old.getBookingNumber() + ") · " + servicesText(next), a);
        return response(next);
    }

    // ---------------------------------------------------------------- timeline

    @Transactional(readOnly = true)
    public List<BookingLogResponse> log(Long outletId, Long id) {
        Booking b = appointment(outletId, id);
        return logs.findByBookingIdOrderByIdAsc(b.getId()).stream()
                .map(l -> new BookingLogResponse(l.getId(), l.getKind().name(), l.getMessage(), l.getAuthorName(), l.getCreatedAt()))
                .toList();
    }

    /** Comments are allowed at any time, also after the booking ended. Returns the whole timeline. */
    public List<BookingLogResponse> comment(Long outletId, Long id, CommentRequest r, LogActor a) {
        Booking b = appointment(outletId, id);
        String text = blank(r.text());
        if (text == null) throw new IllegalArgumentException("Write a comment first");
        log(b, BookingLogKind.COMMENT, text, a);
        return log(outletId, id);
    }

    // ---------------------------------------------------------------- system cancel ("Not done by end of day")

    /** Cancels this outlet's appointments of earlier days that are still Booked. Safe to repeat; returns how many. */
    public int sweepOutlet(Long outletId) {
        LocalDate today = today();
        Instant now = Instant.now();
        List<Booking> stale = bookings.staleAppointments(outletId, today);
        for (Booking b : stale) {
            b.cancel(NOT_DONE, true, now);
            log(b, BookingLogKind.AUTO_CANCELLED, "Cancelled by the system: " + NOT_DONE.toLowerCase() + " (" + format(b.getStartDate()) + ")", LogActor.SYSTEM);
        }
        sweptOn.put(outletId, today);
        return stale.size();
    }

    /** Outlets that have leftovers to cancel (the 6:00 AM job visits each in its own transaction). */
    @Transactional(readOnly = true)
    public List<Long> outletsToSweep() {
        return bookings.outletsWithStaleAppointments(today());
    }

    /** First use of the day for this outlet: cancel leftovers before showing anything. */
    private void ensureSwept(Long outletId) {
        if (!today().equals(sweptOn.get(outletId))) sweepOutlet(outletId);
    }

    // ---------------------------------------------------------------- helpers

    private Booking create(
            Outlet outlet,
            OutletCustomer customer,
            LocalDate date,
            LocalTime time,
            String notes,
            Map<ServiceItem, Integer> lines) {
        Booking b = new Booking(outlet, customer, BookingKind.APPOINTMENT, date, time, null, notes);
        lines.forEach((item, qty) -> b.getItems().add(new BookingItem(b, item, qty)));
        Booking saved = bookings.saveAndFlush(b);
        saved.setBookingNumber(BillService.outletPrefix(outlet) + "-BK-" + String.format("%06d", saved.getId()));
        return saved;
    }

    /** Each line must be an enabled parlour service of this outlet; the same service twice is merged. */
    private Map<ServiceItem, Integer> resolve(Long outletId, List<ParlourLine> lines) {
        Map<Long, Integer> qty = new TreeMap<>();
        lines.forEach(l -> qty.merge(l.itemId(), l.quantity(), Integer::sum));
        Map<ServiceItem, Integer> out = new LinkedHashMap<>();
        for (var e : qty.entrySet()) {
            ServiceItem i =
                    items.findByIdAndOutletId(e.getKey(), outletId)
                            .orElseThrow(() -> new ResourceNotFoundException("Service not found"));
            if (i.getService().getModule() != OutletModule.PARLOUR)
                throw new IllegalArgumentException("\"" + i.getName() + "\" is not a parlour service");
            if (!assignments.isUsable(outletId, i))
                throw new IllegalArgumentException("\"" + i.getName() + "\" is not available at this outlet");
            out.put(i, e.getValue());
        }
        return out;
    }

    /** " · added Hair spa · removed Threading" when the services done differ from the booking. */
    private static String changes(Booking b, Map<ServiceItem, Integer> done) {
        Map<Long, Integer> booked = new HashMap<>();
        b.getItems().forEach(i -> booked.merge(i.getServiceItem().getId(), i.getQuantity(), Integer::sum));
        List<String> added = new ArrayList<>(), removed = new ArrayList<>();
        done.forEach((item, q) -> {
            int was = booked.getOrDefault(item.getId(), 0);
            if (q > was) added.add(item.getName() + (q - was > 1 ? " × " + (q - was) : ""));
        });
        b.getItems().forEach(i -> {
            int now = done.entrySet().stream().filter(e -> e.getKey().getId().equals(i.getServiceItem().getId())).mapToInt(Map.Entry::getValue).sum();
            if (now < i.getQuantity()) removed.add(i.getServiceItem().getName() + (i.getQuantity() - now > 1 ? " × " + (i.getQuantity() - now) : ""));
        });
        return (added.isEmpty() ? "" : " · added " + String.join(", ", added))
                + (removed.isEmpty() ? "" : " · removed " + String.join(", ", removed));
    }

    private OutletCustomer customer(Outlet outlet, String mobile, String name) {
        String m = mobile == null ? "" : mobile.trim();
        if (!m.matches("[0-9]{10}")) throw new IllegalArgumentException("Mobile number must be exactly 10 digits");
        String n = blank(name);
        if (n == null) throw new IllegalArgumentException("Enter the customer's name");
        OutletCustomer c =
                customers.findByOutletIdAndMobileNumber(outlet.getId(), m)
                        .orElseGet(() -> customers.save(new OutletCustomer(outlet, m, n)));
        c.setName(n);
        return c;
    }

    private Outlet outlet(Long outletId) {
        return outlets.findById(outletId).orElseThrow(() -> new ResourceNotFoundException("Outlet not found"));
    }

    private Booking appointment(Long outletId, Long id) {
        return bookings.findByIdAndOutletId(id, outletId)
                .filter(b -> b.getKind() == BookingKind.APPOINTMENT)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));
    }

    private Booking lockAppointment(Long outletId, Long id) {
        return bookings.findForUpdate(id, outletId)
                .filter(b -> b.getKind() == BookingKind.APPOINTMENT)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));
    }

    private static Booking openAppointment(Booking b) {
        if (b.getStatus() != BookingStatus.BOOKED)
            throw new IllegalArgumentException("This booking is already " + statusWord(b));
        return b;
    }

    private static String statusWord(Booking b) {
        return switch (b.getStatus()) {
            case COMPLETED -> "done";
            case CANCELLED -> "cancelled";
            default -> b.getStatus().name().toLowerCase();
        };
    }

    private void log(Booking b, BookingLogKind kind, String message, LogActor a) {
        logs.save(new BookingLog(b, kind, message, a.user(), a.name()));
    }

    private static String when(Booking b) {
        return format(b.getStartDate())
                + (b.getStartTime() == null ? "" : " " + b.getStartTime().format(TIME).toLowerCase());
    }

    private static String servicesText(Booking b) {
        return String.join(
                ", ",
                b.getItems().stream()
                        .map(i -> i.getQuantity() > 1 ? i.getServiceItem().getName() + " × " + i.getQuantity() : i.getServiceItem().getName())
                        .toList());
    }

    private static BigDecimal estimate(Booking b) {
        return b.getItems().stream()
                .map(i -> i.getServiceItem().getPrice().multiply(BigDecimal.valueOf(i.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
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

    private ParlourAppointmentResponse response(Booking b) {
        return new ParlourAppointmentResponse(
                b.getId(),
                b.getBookingNumber(),
                b.getStatus() == BookingStatus.COMPLETED ? "DONE" : b.getStatus().name(),
                b.isAutoCancelled(),
                b.getCustomerName(),
                b.getCustomerMobile(),
                b.getStartDate(),
                b.getStartTime(),
                b.getNotes(),
                b.getCreatedAt(),
                b.getItems().stream()
                        .map(
                                i ->
                                        new ParlourAppointmentResponse.Item(
                                                i.getServiceItem().getId(),
                                                i.getServiceItem().getName(),
                                                i.getServiceItem().getService().getName(),
                                                i.getServiceItem().getPrice(),
                                                i.getQuantity()))
                        .toList(),
                estimate(b),
                b.getBill() == null ? null : billService.toResponse(b.getBill()),
                b.getCancelReason(),
                b.getCancelledAt(),
                b.getRescheduledTo() == null ? null : b.getRescheduledTo().getBookingNumber(),
                bookings.findByRescheduledToId(b.getId()).map(Booking::getBookingNumber).orElse(null));
    }
}
