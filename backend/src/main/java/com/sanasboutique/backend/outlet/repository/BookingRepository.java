package com.sanasboutique.backend.outlet.repository;

import com.sanasboutique.backend.outlet.entity.*;

import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.*;

public interface BookingRepository extends JpaRepository<Booking, Long> {
    Optional<Booking> findByIdAndOutletId(Long id, Long outletId);

    // ---- Jewellery rentals (kind RENTAL); every query is scoped to one outlet.

    String RENTAL = " b.kind = com.sanasboutique.backend.outlet.entity.BookingKind.RENTAL";
    String BOOKED = " b.status = com.sanasboutique.backend.outlet.entity.BookingStatus.BOOKED";
    String WITH_CUSTOMER = " b.status = com.sanasboutique.backend.outlet.entity.BookingStatus.HANDED_OVER";

    /** A rental found by the number on its delivery challan (scan). */
    @Query("select b from Booking b join b.challanBill c where b.outlet.id = :outletId and lower(c.billNumber) = lower(:number)")
    Optional<Booking> findByChallanNumber(@Param("outletId") Long outletId, @Param("number") String number);

    /** Pre-bookings whose take-away date has passed without being collected. */
    @Query("select b from Booking b where b.outlet.id = :outletId and" + RENTAL + " and" + BOOKED + " and b.startDate < :day")
    List<Booking> staleRentals(@Param("outletId") Long outletId, @Param("day") LocalDate day);

    /** Pre-bookings to collect on the day. */
    @Query("select b from Booking b where b.outlet.id = :outletId and" + RENTAL + " and" + BOOKED + " and b.startDate = :day order by b.id")
    List<Booking> rentalsToCollect(@Param("outletId") Long outletId, @Param("day") LocalDate day);

    /** With the customer and due back on the day. */
    @Query("select b from Booking b where b.outlet.id = :outletId and" + RENTAL + " and" + WITH_CUSTOMER + " and b.expectedReturnDate = :day order by b.id")
    List<Booking> rentalsDueBack(@Param("outletId") Long outletId, @Param("day") LocalDate day);

    /** With the customer past the return date, oldest first. */
    @Query("select b from Booking b where b.outlet.id = :outletId and" + RENTAL + " and" + WITH_CUSTOMER + " and b.expectedReturnDate < :day order by b.expectedReturnDate, b.id")
    List<Booking> rentalsLate(@Param("outletId") Long outletId, @Param("day") LocalDate day);

    /** Find rentals: statuses, optional auto-cancelled filter, search by name, mobile, booking or challan number. */
    @Query(
            "select b from Booking b left join b.challanBill c where b.outlet.id = :outletId and"
                    + RENTAL
                    + " and b.status in :statuses and (:auto is null or b.autoCancelled = :auto)"
                    + " and (lower(b.customerName) like lower(concat('%', :search, '%')) or"
                    + " b.customerMobile like concat('%', :search, '%') or lower(b.bookingNumber) like"
                    + " lower(concat('%', :search, '%')) or lower(c.billNumber) like lower(concat('%', :search, '%')))")
    Page<Booking> searchRentals(
            @Param("outletId") Long outletId,
            @Param("statuses") Collection<BookingStatus> statuses,
            @Param("auto") Boolean auto,
            @Param("search") String search,
            Pageable pageable);

    // ---- Parlour appointments (kind APPOINTMENT); every query is scoped to one outlet.

    String APPOINTMENT = " b.kind = com.sanasboutique.backend.outlet.entity.BookingKind.APPOINTMENT";

    /** Same, locking the row: billing and cancelling run one at a time per booking. */
    @Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select b from Booking b where b.id = :id and b.outlet.id = :outletId")
    Optional<Booking> findForUpdate(@Param("id") Long id, @Param("outletId") Long outletId);

    Optional<Booking> findByBookingNumberIgnoreCaseAndOutletId(String bookingNumber, Long outletId);

    /** The booking that "Cancel & reschedule" replaced with this one. */
    Optional<Booking> findByRescheduledToId(Long id);

    /** Appointments of earlier days still Booked: cancelled by the 6:00 AM job / first-use sweep. */
    @Query(
            "select b from Booking b where b.outlet.id = :outletId and"
                    + APPOINTMENT
                    + " and b.status = com.sanasboutique.backend.outlet.entity.BookingStatus.BOOKED"
                    + " and b.startDate < :day")
    List<Booking> staleAppointments(@Param("outletId") Long outletId, @Param("day") LocalDate day);

    /** Outlets that have stale appointments (the 6:00 AM job visits only these). */
    @Query(
            "select distinct b.outlet.id from Booking b where"
                    + APPOINTMENT
                    + " and b.status = com.sanasboutique.backend.outlet.entity.BookingStatus.BOOKED"
                    + " and b.startDate < :day")
    List<Long> outletsWithStaleAppointments(@Param("day") LocalDate day);

    /** One day's appointments in time order (all statuses). */
    @Query(
            "select b from Booking b where b.outlet.id = :outletId and"
                    + APPOINTMENT
                    + " and b.startDate = :day order by b.startTime, b.id")
    List<Booking> appointmentsOn(@Param("outletId") Long outletId, @Param("day") LocalDate day);

    /** Find appointments: statuses, optional auto-cancelled filter, search by name, mobile or booking number. */
    @Query(
            "select b from Booking b where b.outlet.id = :outletId and"
                    + APPOINTMENT
                    + " and b.status in :statuses and (:auto is null or b.autoCancelled = :auto)"
                    + " and (lower(b.customerName) like lower(concat('%', :search, '%')) or"
                    + " b.customerMobile like concat('%', :search, '%') or lower(b.bookingNumber) like"
                    + " lower(concat('%', :search, '%')))")
    Page<Booking> searchAppointments(
            @Param("outletId") Long outletId,
            @Param("statuses") Collection<BookingStatus> statuses,
            @Param("auto") Boolean auto,
            @Param("search") String search,
            Pageable pageable);

    /** Bookings of an outlet in the given statuses, matching customer name or mobile, sorted by the caller's Pageable. */
    @Query(
            "select b from Booking b where b.outlet.id = :outletId and b.status in :statuses and"
                + " (lower(b.customerName) like lower(concat('%', :search, '%')) or"
                + " b.customerMobile like concat('%', :search, '%'))")
    Page<Booking> findForOutlet(
            @Param("outletId") Long outletId,
            @Param("statuses") Collection<BookingStatus> statuses,
            @Param("search") String search,
            Pageable pageable);

    /** Rental bookings that may block an item; callers refine the exact end (handed-over bookings run on until returned). */
    @Query(
            "select distinct b from Booking b join b.items i where b.outlet.id = :outletId and"
                + " i.serviceItem.id = :itemId and b.kind ="
                + " com.sanasboutique.backend.outlet.entity.BookingKind.RENTAL and b.status in"
                + " (com.sanasboutique.backend.outlet.entity.BookingStatus.BOOKED,"
                + " com.sanasboutique.backend.outlet.entity.BookingStatus.HANDED_OVER) and"
                + " (b.startDate <= :end or b.handedOverOn <= :end)")
    List<Booking> activeRentalsStartingBy(
            @Param("outletId") Long outletId,
            @Param("itemId") Long itemId,
            @Param("end") LocalDate end);

    /** Bookings touching a calendar day: starting, due back, handed over or returned on it (cancelled excluded). */
    @Query(
            "select distinct b from Booking b where b.outlet.id = :outletId and b.status <>"
                + " com.sanasboutique.backend.outlet.entity.BookingStatus.CANCELLED and"
                + " (b.startDate = :day or b.expectedReturnDate = :day or b.handedOverOn = :day or"
                + " b.returnedOn = :day)")
    List<Booking> forDay(@Param("outletId") Long outletId, @Param("day") LocalDate day);

    /** A customer's not-yet-started bookings that are due on or before the given day. */
    @Query(
            "select b from Booking b where b.outlet.id = :outletId and b.customerMobile = :mobile"
                + " and b.status = com.sanasboutique.backend.outlet.entity.BookingStatus.BOOKED and"
                + " b.startDate <= :day order by b.startDate, b.startTime, b.id")
    List<Booking> dueFor(
            @Param("outletId") Long outletId,
            @Param("mobile") String mobile,
            @Param("day") LocalDate day);

    /** Rentals still out with the customer after their expected return date. */
    @Query(
            "select b from Booking b where b.outlet.id = :outletId and b.status ="
                + " com.sanasboutique.backend.outlet.entity.BookingStatus.HANDED_OVER and"
                + " b.expectedReturnDate < :day order by b.expectedReturnDate, b.id")
    List<Booking> overdueReturns(@Param("outletId") Long outletId, @Param("day") LocalDate day);

    /** Pieces of an item currently out with customers (physically removed from stock but still owned). */
    @Query(
            "select coalesce(sum(i.quantity), 0) from Booking b join b.items i where b.outlet.id ="
                + " :outletId and i.serviceItem.id = :itemId and b.status ="
                + " com.sanasboutique.backend.outlet.entity.BookingStatus.HANDED_OVER")
    long quantityOut(@Param("outletId") Long outletId, @Param("itemId") Long itemId);
}
