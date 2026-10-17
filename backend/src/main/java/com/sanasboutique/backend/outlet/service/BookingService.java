package com.sanasboutique.backend.outlet.service;

import com.sanasboutique.backend.catalog.entity.ServiceItem;
import com.sanasboutique.backend.common.DisplayDates;
import com.sanasboutique.backend.outlet.dto.response.*;
import com.sanasboutique.backend.outlet.entity.*;
import com.sanasboutique.backend.outlet.repository.*;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * What is left of the old shared "Bookings" module (owner decision 2026-10-11: removed; bookings
 * live in the Jewellery rental and Parlour modules):
 * - the rental availability check (stock, pieces out, overlapping bookings), used by RentalService;
 * - the read-only day / overdue lists for the Overview dashboard schedule.
 */
@Service
@Transactional
public class BookingService {
    private static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");
    private static final int MAX_RENTAL_DAYS = 366;
    private final BookingRepository bookings;
    private final BillService billService;

    public BookingService(BookingRepository b, BillService bs) {
        bookings = b;
        billService = bs;
    }

    /** Can `wanted` pieces be out for [from, to], ignoring one booking (its own)? Used by RentalService. */
    AvailabilityResponse availability(
            Long outletId,
            ServiceItem item,
            LocalDate from,
            LocalDate to,
            int wanted,
            Long ignoreBookingId) {
        if (ChronoUnit.DAYS.between(from, to) >= MAX_RENTAL_DAYS)
            throw new IllegalArgumentException(
                    "Rental period cannot exceed " + MAX_RENTAL_DAYS + " days");
        int capacity = capacity(outletId, item);
        if (capacity <= 0)
            return new AvailabilityResponse(false, "Not in stock at this outlet", List.of());
        if (wanted > capacity)
            return new AvailabilityResponse(
                    false, "Only " + capacity + " in total at this outlet", List.of());
        List<Booking> overlapping = new ArrayList<>();
        for (Booking o : bookings.activeRentalsStartingBy(outletId, item.getId(), to)) {
            if (Objects.equals(o.getId(), ignoreBookingId)) continue;
            if (!occupiedFrom(o).isAfter(to) && !occupiedUntil(o).isBefore(from))
                overlapping.add(o);
        }
        List<AvailabilityResponse.Conflict> conflicts =
                overlapping.stream()
                        .map(
                                o ->
                                        new AvailabilityResponse.Conflict(
                                                occupiedFrom(o),
                                                occupiedUntil(o),
                                                o.getCustomerName(),
                                                o.getStatus().name()))
                        .toList();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            final LocalDate day = d;
            List<Booking> onDay =
                    overlapping.stream()
                            .filter(
                                    o ->
                                            !occupiedFrom(o).isAfter(day)
                                                    && !occupiedUntil(o).isBefore(day))
                            .toList();
            int taken = onDay.stream().mapToInt(o -> qtyOf(o, item.getId())).sum();
            if (taken + wanted > capacity) {
                int free = Math.max(0, capacity - taken);
                return new AvailabilityResponse(
                        false,
                        free == 0
                                ? "Not available on "
                                        + DisplayDates.format(day)
                                        + " (booked by "
                                        + onDay.get(0).getCustomerName()
                                        + ", "
                                        + DisplayDates.format(occupiedFrom(onDay.get(0)))
                                        + " to "
                                        + DisplayDates.format(occupiedUntil(onDay.get(0)))
                                        + ")"
                                : "Only " + free + " available on " + DisplayDates.format(day),
                        conflicts);
            }
        }
        return new AvailabilityResponse(true, null, conflicts);
    }

    /** Pieces owned for renting: stock on hand plus pieces currently out with customers; untracked items count as one piece. */
    private int capacity(Long outletId, ServiceItem item) {
        Integer onHand = item.getQuantity();
        if (onHand == null) return 1;
        return onHand + (int) bookings.quantityOut(outletId, item.getId());
    }

    private static int qtyOf(Booking b, Long itemId) {
        return b.getItems().stream()
                .filter(i -> i.getServiceItem().getId().equals(itemId))
                .mapToInt(BookingItem::getQuantity)
                .sum();
    }

    private static LocalDate occupiedFrom(Booking b) {
        return b.getHandedOverOn() != null && b.getHandedOverOn().isBefore(b.getStartDate())
                ? b.getHandedOverOn()
                : b.getStartDate();
    }

    /** A piece still with the customer past the expected date stays blocked until it is returned. */
    private static LocalDate occupiedUntil(Booking b) {
        LocalDate e = b.getExpectedReturnDate();
        if (b.getStatus() == BookingStatus.HANDED_OVER && today().isAfter(e)) return today();
        return e;
    }

    /** Overview schedule: everything on one day (appointments, rental take-aways and returns), timed entries first. */
    @Transactional(readOnly = true)
    public List<BookingResponse> day(Long outletId, LocalDate day) {
        return bookings.forDay(outletId, day).stream()
                .sorted(
                        Comparator.comparing(
                                        Booking::getStartTime,
                                        Comparator.nullsLast(Comparator.naturalOrder()))
                                .thenComparing(Booking::getId))
                .map(this::response)
                .toList();
    }

    /** Overview: rentals not yet returned although the return date has passed, oldest first. */
    @Transactional(readOnly = true)
    public List<BookingResponse> overdue(Long outletId) {
        return bookings.overdueReturns(outletId, today()).stream().map(this::response).toList();
    }

    /** Days charged: return date minus hand-over date, at least 1. */
    private static int days(LocalDate from, LocalDate to) {
        return (int) Math.max(1, ChronoUnit.DAYS.between(from, to));
    }

    private static LocalDate today() {
        return LocalDate.now(ZONE);
    }

    private BookingResponse response(Booking b) {
        List<BookingResponse.Item> lines =
                b.getItems().stream()
                        .map(
                                bi -> {
                                    ServiceItem i = bi.getServiceItem();
                                    return new BookingResponse.Item(
                                            i.getId(),
                                            i.getName(),
                                            i.getItemCode(),
                                            i.getService().getName(),
                                            i.getPrice(),
                                            bi.getQuantity());
                                })
                        .toList();
        BigDecimal sum =
                b.getItems().stream()
                        .map(
                                bi ->
                                        bi.getServiceItem()
                                                .getPrice()
                                                .multiply(BigDecimal.valueOf(bi.getQuantity())))
                        .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal estimate = sum;
        if (b.getKind() == BookingKind.RENTAL) {
            LocalDate from = b.getHandedOverOn() != null ? b.getHandedOverOn() : b.getStartDate(),
                    to = b.getReturnedOn() != null ? b.getReturnedOn() : b.getExpectedReturnDate();
            estimate = sum.multiply(BigDecimal.valueOf(days(from, to)));
        }
        return new BookingResponse(
                b.getId(),
                b.getKind().name(),
                b.getStatus().name(),
                b.getCustomerName(),
                b.getCustomerMobile(),
                b.getStartDate(),
                b.getStartTime(),
                b.getExpectedReturnDate(),
                b.getHandedOverOn(),
                b.getReturnedOn(),
                b.getNotes(),
                b.getCreatedAt(),
                lines,
                estimate,
                b.getBill() == null ? null : billService.toResponse(b.getBill()),
                b.getChallanBill() == null ? null : billService.toResponse(b.getChallanBill()));
    }
}
