package com.sanasboutique.backend.outlet.service;

import com.sanasboutique.backend.catalog.entity.ServiceItem;
import com.sanasboutique.backend.catalog.exception.ResourceNotFoundException;
import com.sanasboutique.backend.catalog.repository.ServiceItemRepository;
import com.sanasboutique.backend.outlet.dto.request.*;
import com.sanasboutique.backend.outlet.dto.response.*;
import com.sanasboutique.backend.outlet.entity.*;
import com.sanasboutique.backend.outlet.repository.*;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.*;
import java.time.*;
import java.util.*;

@Service
@Transactional
public class BillService {
    private final BillRepository bills;
    private final ServiceItemRepository items;
    private final OutletRepository outlets;
    private final OutletCustomerRepository customers;
    private final OutletServiceAssignmentService assignments;
    private final com.sanasboutique.backend.outlet.mapper.OutletMapper outletMapper;
    private final BookingRepository bookings;
    private static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");

    public BillService(
            BillRepository b,
            ServiceItemRepository i,
            OutletRepository o,
            OutletCustomerRepository c,
            OutletServiceAssignmentService a,
            com.sanasboutique.backend.outlet.mapper.OutletMapper om,
            BookingRepository bk) {
        bills = b;
        items = i;
        outlets = o;
        customers = c;
        assignments = a;
        outletMapper = om;
        bookings = bk;
    }

    /** Shop sales bill: shop products only. */
    public BillResponse create(Long outletId, BillRequest r) {
        return createSimple(outletId, r, null);
    }

    /** Bill of a franchisor-created billing module: only that module's items; numbered PREFIX-code-000123. */
    public BillResponse createInBillingModule(Long outletId, com.sanasboutique.backend.catalog.entity.BillingModule module, BillRequest r) {
        return createSimple(outletId, r, module);
    }

    /** Simple billing (fixed prices, discount only, stock reduced): Shop sales when module is null, else that billing module. */
    private BillResponse createSimple(Long outletId, BillRequest r, com.sanasboutique.backend.catalog.entity.BillingModule module) {
        Outlet outlet =
                outlets.findById(outletId)
                        .orElseThrow(() -> new ResourceNotFoundException("Outlet not found"));
        Map<Long, Integer> quantities = new TreeMap<>();
        (r.items() == null ? List.<BillLineRequest>of() : r.items())
                .forEach(
                        x ->
                                quantities.merge(
                                        x.itemId(),
                                        x.quantity(),
                                        Integer::sum)); // sorted ids => consistent lock order
        List<ServiceItem> resolved = new ArrayList<>();
        BigDecimal subtotal = BigDecimal.ZERO;
        for (var entry : quantities.entrySet()) {
            ServiceItem item =
                    items.findByIdForUpdate(entry.getKey())
                            .orElseThrow(() -> new ResourceNotFoundException("Product not found"));
            if (!assignments.isUsable(outletId, item))
                throw new ResourceNotFoundException("Product is not enabled for this outlet");
            // Each module bills its own items: rentals, parlour services and stitching have their own screens.
            boolean belongs = module == null
                    ? item.getService().getModule() == com.sanasboutique.backend.common.OutletModule.SALES
                    : item.getService().getBillingModule() != null && item.getService().getBillingModule().getId().equals(module.getId());
            if (!belongs)
                throw new IllegalArgumentException(
                        "\"" + item.getName() + "\" is not part of " + (module == null ? "Shop sales" : module.getName()) + ". Bill it in its own module.");
            // Stock is the outlet's own product quantity; null means the item is not stock-tracked.
            int qty = entry.getValue();
            if (item.getQuantity() != null) {
                int left = item.getQuantity();
                if (qty > left)
                    throw new IllegalArgumentException(
                            "Only " + left + " of \"" + item.getName() + "\" available in stock");
                item.setQuantity(left - qty);
            }
            resolved.add(item);
            subtotal = subtotal.add(item.getPrice().multiply(BigDecimal.valueOf(qty)));
        }
        if (quantities.isEmpty())
            throw new IllegalArgumentException("Add at least one product to the bill");
        BigDecimal discount = money(r.discount());
        if (discount.compareTo(subtotal) > 0)
            throw new IllegalArgumentException("Discount cannot exceed subtotal");
        if (!r.customerMobile().matches("[0-9]{10}"))
            throw new IllegalArgumentException("Mobile number must be exactly 10 digits");
        OutletCustomer customer =
                customers
                        .findByOutletIdAndMobileNumber(outletId, r.customerMobile())
                        .orElseGet(
                                () ->
                                        customers.save(
                                                new OutletCustomer(
                                                        outlet,
                                                        r.customerMobile().trim(),
                                                        r.customerName().trim())));
        customer.setName(r.customerName().trim());
        Bill saved =
                bills.saveAndFlush(
                        new Bill(
                                outlet,
                                "TEMP",
                                customer.getName(),
                                customer.getMobileNumber(),
                                discount,
                                subtotal,
                                subtotal.subtract(discount)));
        saved.setCustomer(customer);
        String prefix = outlet.getName().replaceAll("[^A-Za-z0-9]", "").toUpperCase();
        prefix = (prefix + "OUT").substring(0, 3);
        if (module != null) saved.setBillingModule(module);
        saved.setBillNumber(prefix + "-" + (module != null ? module.getCode() + "-" : "") + String.format("%06d", saved.getId()));
        bills.flush(); // write the real number now, so a second bill in the same transaction can use the "TEMP" placeholder too
        for (int n = 0; n < resolved.size(); n++) {
            saved.getItems()
                    .add(
                            new BillItem(
                                    saved,
                                    resolved.get(n),
                                    quantities.get(resolved.get(n).getId())));
        }
        return response(saved);
    }

    /** The 10 latest Shop sales bills of the outlet. */
    @Transactional(readOnly = true)
    public List<BillResponse> recentSales(Long outletId) {
        return bills.findTop10ByOutletIdAndModuleAndBillTypeOrderByCreatedAtDesc(
                        outletId, com.sanasboutique.backend.common.OutletModule.SALES, BillType.BILL)
                .stream()
                .map(this::response)
                .toList();
    }

    @Transactional(readOnly = true)
    public BillPageResponse page(Long outletId, String search, int page, String from, String to) {
        return toPage(
                bills.findForOutlet(
                        outletId,
                        q(search),
                        start(from),
                        end(to),
                        PageRequest.of(Math.max(0, page), 50)));
    }

    @Transactional(readOnly = true)
    public BillPageResponse adminPage(
            Long outletId, String search, int page, String from, String to) {
        if (outletId != null)
            outlets.findById(outletId)
                    .orElseThrow(() -> new ResourceNotFoundException("Outlet not found"));
        PageRequest p = PageRequest.of(Math.max(0, page), 50);
        return toPage(
                outletId == null
                        ? bills.findForAll(q(search), start(from), end(to), p)
                        : bills.findForOutlet(outletId, q(search), start(from), end(to), p));
    }

    @Transactional(readOnly = true)
    public AdminOutletDashboardResponse adminOutletDashboard(Long outletId) {
        Outlet o =
                outlets.findById(outletId)
                        .orElseThrow(() -> new ResourceNotFoundException("Outlet not found"));
        Instant s = todayStart(), e = tomorrowStart();
        return new AdminOutletDashboardResponse(
                outletMapper.toResponse(o),
                bills.sumForOutlet(outletId, s, e),
                bills.countForOutlet(outletId, s, e));
    }

    @Transactional(readOnly = true)
    public AdminSalesSummaryResponse adminSummary() {
        Instant ts = todayStart(),
                te = tomorrowStart(),
                ms = LocalDate.now(ZONE).withDayOfMonth(1).atStartOfDay(ZONE).toInstant();
        List<Outlet> all = outlets.findAllByOrderByNameAsc();
        return new AdminSalesSummaryResponse(
                bills.sumForAll(ts, te),
                bills.countForAll(ts, te),
                bills.sumForAll(ms, te),
                all.size(),
                all.stream().filter(Outlet::isActive).count(),
                all.stream()
                        .map(
                                o ->
                                        new AdminSalesSummaryResponse.OutletSales(
                                                o.getId(),
                                                o.getName(),
                                                o.isActive(),
                                                bills.sumForOutlet(o.getId(), ts, te),
                                                bills.sumForOutlet(o.getId(), ms, te)))
                        .toList());
    }

    @Transactional(readOnly = true)
    public List<CustomerResponse> customers(Long outletId, String mobile) {
        return customers
                .findTop10ByOutletIdAndMobileNumberContainingOrderByNameAsc(
                        outletId, mobile == null ? "" : mobile)
                .stream()
                .map(c -> new CustomerResponse(c.getMobileNumber(), c.getName()))
                .toList();
    }

    @Transactional(readOnly = true)
    public BigDecimal todayTotal(Long outletId) {
        return bills.sumForOutlet(outletId, todayStart(), tomorrowStart());
    }

    @Transactional(readOnly = true)
    public CustomerPageResponse customerPage(Long outletId, String search, int page) {
        Page<OutletCustomer> r =
                customers.search(outletId, q(search), PageRequest.of(Math.max(0, page), 50));
        Map<String, Object[]> stats = statsFor(outletId, r.getContent());
        return new CustomerPageResponse(
                r.getContent().stream()
                        .map(c -> detail(c, stats.get(c.getMobileNumber())))
                        .toList(),
                r.getNumber(),
                r.getSize(),
                r.getTotalPages(),
                r.getTotalElements());
    }

    @Transactional(readOnly = true)
    public CustomerDetailResponse customer(Long outletId, Long id) {
        OutletCustomer c =
                customers
                        .findByIdAndOutletId(id, outletId)
                        .orElseThrow(() -> new ResourceNotFoundException("Customer not found"));
        return detail(c, statsFor(outletId, List.of(c)).get(c.getMobileNumber()));
    }

    @Transactional(readOnly = true)
    public BillPageResponse customerBills(Long outletId, Long id, String search, int page) {
        OutletCustomer c =
                customers
                        .findByIdAndOutletId(id, outletId)
                        .orElseThrow(() -> new ResourceNotFoundException("Customer not found"));
        return toPage(
                bills.findForCustomer(
                        outletId,
                        c.getMobileNumber(),
                        q(search),
                        PageRequest.of(Math.max(0, page), 50)));
    }

    private Map<String, Object[]> statsFor(Long outletId, List<OutletCustomer> list) {
        Map<String, Object[]> m = new HashMap<>();
        if (list.isEmpty()) return m;
        for (Object[] row :
                bills.statsForMobiles(
                        outletId, list.stream().map(OutletCustomer::getMobileNumber).toList()))
            m.put((String) row[0], row);
        return m;
    }

    private static CustomerDetailResponse detail(OutletCustomer c, Object[] s) {
        return new CustomerDetailResponse(
                c.getId(),
                c.getName(),
                c.getMobileNumber(),
                c.getCreatedAt(),
                s == null ? 0 : (Long) s[1],
                s == null ? BigDecimal.ZERO : (BigDecimal) s[2],
                s == null ? null : (Instant) s[3]);
    }

    public static final String CHALLAN_LABEL = " (rental hand-over, challan)";

    /** unitPrice null = the item's own price; zero = challan line. */
    public record BookingLine(ServiceItem item, int quantity, String label, BigDecimal unitPrice) {
        public BookingLine(ServiceItem item, int quantity, String label) {
            this(item, quantity, label, null);
        }

        BigDecimal amount() {
            return (unitPrice == null ? item.getPrice() : unitPrice)
                    .multiply(BigDecimal.valueOf(quantity));
        }
    }

    /** Move stock in or out (negative = out) on the outlet's own product; untracked items are left alone. */
    public void adjustStock(Long outletId, ServiceItem item, int delta) {
        if (item.getQuantity() != null) {
            int next = item.getQuantity() + delta;
            if (next < 0)
                throw new IllegalArgumentException(
                        "Only "
                                + item.getQuantity()
                                + " of \""
                                + item.getName()
                                + "\" available in stock");
            item.setQuantity(next);
        }
    }

    /** Bill for a booking (rental return / completed appointment). Does not touch stock: rentals come back, appointments are not stock-tracked. */
    public Bill createForBooking(
            Outlet outlet, OutletCustomer customer, BigDecimal discount, List<BookingLine> lines) {
        BigDecimal subtotal = BigDecimal.ZERO;
        for (BookingLine l : lines) subtotal = subtotal.add(l.amount());
        BigDecimal d = money(discount);
        if (d.compareTo(subtotal) > 0)
            throw new IllegalArgumentException("Discount cannot exceed subtotal");
        Bill saved =
                bills.saveAndFlush(
                        new Bill(
                                outlet,
                                "TEMP",
                                customer.getName(),
                                customer.getMobileNumber(),
                                d,
                                subtotal,
                                subtotal.subtract(d)));
        saved.setCustomer(customer);
        String prefix =
                (outlet.getName().replaceAll("[^A-Za-z0-9]", "").toUpperCase() + "OUT")
                        .substring(0, 3);
        saved.setBillNumber(prefix + "-" + String.format("%06d", saved.getId()));
        bills.flush(); // write the real number now, so a second bill in the same transaction can use the "TEMP" placeholder too
        for (BookingLine l : lines)
            saved.getItems()
                    .add(new BillItem(saved, l.item(), l.quantity(), l.label(), l.unitPrice()));
        return saved;
    }

    public record CustomLine(String name, String serviceLabel, BigDecimal amount) {}

    /** Bill made of free-form lines (stitching): no catalog items, no stock. Numbered PREFIX-ST-000123. */
    public Bill createCustom(
            Outlet outlet, OutletCustomer customer, BigDecimal discount, List<CustomLine> lines) {
        BigDecimal subtotal = BigDecimal.ZERO;
        for (CustomLine l : lines) subtotal = subtotal.add(l.amount());
        BigDecimal d = money(discount);
        if (d.compareTo(subtotal) > 0)
            throw new IllegalArgumentException("Discount cannot exceed subtotal");
        Bill saved =
                bills.saveAndFlush(
                        new Bill(
                                outlet,
                                "TEMP",
                                customer.getName(),
                                customer.getMobileNumber(),
                                d,
                                subtotal,
                                subtotal.subtract(d)));
        saved.setCustomer(customer);
        saved.setBillNumber(outletPrefix(outlet) + "-ST-" + String.format("%06d", saved.getId()));
        bills.flush(); // write the real number now, so a second bill in the same transaction can use the "TEMP" placeholder too
        for (CustomLine l : lines)
            saved.getItems().add(new BillItem(saved, l.name(), l.serviceLabel(), l.amount(), 1));
        saved.setModule(com.sanasboutique.backend.common.OutletModule.STITCHING);
        return saved;
    }

    /** Files a bill under a module and numbers it PREFIX-<letter>-000123 (e.g. "P" for parlour). */
    public void fileUnder(Bill b, com.sanasboutique.backend.common.OutletModule module, String letter) {
        b.setModule(module);
        b.setBillNumber(outletPrefix(b.getOutlet()) + "-" + letter + "-" + String.format("%06d", b.getId()));
        bills.flush();
    }

    /** A franchisor-created billing module's bills of an outlet, newest first. */
    @Transactional(readOnly = true)
    public BillPageResponse billingModulePage(Long outletId, Long billingModuleId, String search, int page, String from, String to) {
        return toPage(bills.findForOutletBillingModule(outletId, billingModuleId, q(search), start(from), end(to), PageRequest.of(Math.max(0, page), 50)));
    }

    /** The 10 latest bills of a franchisor-created billing module. */
    @Transactional(readOnly = true)
    public List<BillResponse> recentInBillingModule(Long outletId, Long billingModuleId) {
        return bills.findTop10ByOutletIdAndBillingModuleIdOrderByCreatedAtDesc(outletId, billingModuleId).stream().map(this::response).toList();
    }

    /** One module's bills of an outlet (e.g. Parlour → Bills), newest first. */
    @Transactional(readOnly = true)
    public BillPageResponse modulePage(
            Long outletId,
            com.sanasboutique.backend.common.OutletModule module,
            String search,
            int page,
            String from,
            String to) {
        return toPage(
                bills.findForOutletModule(
                        outletId, module, q(search), start(from), end(to), PageRequest.of(Math.max(0, page), 50)));
    }

    /** First 3 letters of the outlet name (padded with "OUT"), used in bill, booking and refund numbers. */
    public static String outletPrefix(Outlet outlet) {
        return (outlet.getName().replaceAll("[^A-Za-z0-9]", "").toUpperCase() + "OUT").substring(0, 3);
    }

    public BillResponse toResponse(Bill b) {
        return response(b);
    }

    private BillPageResponse toPage(Page<Bill> result) {
        return new BillPageResponse(
                result.getContent().stream().map(this::response).toList(),
                result.getNumber(),
                result.getSize(),
                result.getTotalPages(),
                result.getTotalElements());
    }

    private static String q(String search) {
        return search == null ? "" : search.trim();
    }

    private static Instant todayStart() {
        return LocalDate.now(ZONE).atStartOfDay(ZONE).toInstant();
    }

    private static Instant tomorrowStart() {
        return LocalDate.now(ZONE).plusDays(1).atStartOfDay(ZONE).toInstant();
    }

    /** Inclusive start of the "from" day (IST); unbounded when blank. */
    private static Instant start(String from) {
        LocalDate d = date(from, "from");
        return d == null ? Instant.EPOCH : d.atStartOfDay(ZONE).toInstant();
    }

    /** Exclusive end: the day after "to" (IST), so the whole "to" day is included; unbounded when blank. */
    private static Instant end(String to) {
        LocalDate d = date(to, "to");
        return d == null
                ? Instant.parse("9999-01-01T00:00:00Z")
                : d.plusDays(1).atStartOfDay(ZONE).toInstant();
    }

    private static LocalDate date(String v, String name) {
        if (v == null || v.isBlank()) return null;
        try {
            return LocalDate.parse(v.trim());
        } catch (java.time.format.DateTimeParseException e) {
            throw new IllegalArgumentException("Invalid '" + name + "' date, expected yyyy-MM-dd");
        }
    }

    private BillResponse response(Bill b) {
        return new BillResponse(
                b.getId(),
                b.getBillNumber(),
                b.getOutlet().getName(),
                b.getOutlet().getAddress(),
                b.getCustomerName(),
                b.getCustomerMobile(),
                b.getDiscount(),
                b.getSubtotal(),
                b.getTotal(),
                b.getCreatedAt(),
                b.getItems().stream()
                        .map(
                                i ->
                                        new BillItemResponse(
                                                i.getItemName(),
                                                i.getItemCode(),
                                                i.getUnitPrice(),
                                                i.getQuantity(),
                                                i.getLineTotal()))
                        .toList(),
                b.getModule().name(),
                b.getBillType().name(),
                b.getAdvancePaid(),
                b.getTotal().subtract(b.getAdvancePaid()));
    }

    private static BigDecimal money(BigDecimal v) {
        return (v == null ? BigDecimal.ZERO : v).setScale(2, RoundingMode.HALF_UP);
    }
}
