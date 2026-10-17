package com.sanasboutique.backend.outlet.entity;

import jakarta.persistence.*;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.*;
import java.util.*;

@Entity
@Table(name = "booking")
public class Booking {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "outlet_id", nullable = false)
    private Outlet outlet;

    /** Printed on the booking slip; set right after the first insert because it is derived from the id. */
    @Column(name = "booking_number", unique = true)
    private String bookingNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id")
    private OutletCustomer customer;

    @Column(name = "customer_name", nullable = false)
    private String customerName;

    @Column(name = "customer_mobile", nullable = false)
    private String customerMobile;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private BookingKind kind;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private BookingStatus status = BookingStatus.BOOKED;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "start_time")
    private LocalTime startTime;

    @Column(name = "expected_return_date")
    private LocalDate expectedReturnDate;

    @Column(name = "handed_over_on")
    private LocalDate handedOverOn;

    @Column(name = "returned_on")
    private LocalDate returnedOn;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "bill_id")
    private Bill bill;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "challan_bill_id")
    private Bill challanBill;

    private String notes;

    @Column(name = "cancel_reason")
    private String cancelReason;

    @Column(name = "cancelled_at")
    private Instant cancelledAt;

    /** Cancelled by the 6:00 AM job ("Not done by end of day"), not by a person. */
    @Column(name = "auto_cancelled", nullable = false)
    private boolean autoCancelled;

    /** The new booking created by "Cancel & reschedule". */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "rescheduled_to_id")
    private Booking rescheduledTo;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @OneToMany(mappedBy = "booking", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<BookingItem> items = new ArrayList<>();

    protected Booking() {}

    public Booking(
            Outlet outlet,
            OutletCustomer customer,
            BookingKind kind,
            LocalDate startDate,
            LocalTime startTime,
            LocalDate expectedReturnDate,
            String notes) {
        this.outlet = outlet;
        this.customer = customer;
        customerName = customer.getName();
        customerMobile = customer.getMobileNumber();
        this.kind = kind;
        this.startDate = startDate;
        this.startTime = startTime;
        this.expectedReturnDate = expectedReturnDate;
        this.notes = notes;
    }

    public Long getId() {
        return id;
    }

    public Outlet getOutlet() {
        return outlet;
    }

    public String getBookingNumber() {
        return bookingNumber;
    }

    public void setBookingNumber(String n) {
        bookingNumber = n;
    }

    public String getCustomerName() {
        return customerName;
    }

    public String getCustomerMobile() {
        return customerMobile;
    }

    public BookingKind getKind() {
        return kind;
    }

    public BookingStatus getStatus() {
        return status;
    }

    public void setStatus(BookingStatus s) {
        status = s;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public LocalTime getStartTime() {
        return startTime;
    }

    public LocalDate getExpectedReturnDate() {
        return expectedReturnDate;
    }

    /** Return date agreed at hand-over (the caller re-checks availability). */
    public void setExpectedReturnDate(LocalDate d) {
        expectedReturnDate = d;
    }

    public LocalDate getHandedOverOn() {
        return handedOverOn;
    }

    public void setHandedOverOn(LocalDate d) {
        handedOverOn = d;
    }

    public LocalDate getReturnedOn() {
        return returnedOn;
    }

    public void setReturnedOn(LocalDate d) {
        returnedOn = d;
    }

    public Bill getBill() {
        return bill;
    }

    public void setBill(Bill b) {
        bill = b;
    }

    public String getNotes() {
        return notes;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public List<BookingItem> getItems() {
        return items;
    }

    public OutletCustomer getCustomer() {
        return customer;
    }

    public Bill getChallanBill() {
        return challanBill;
    }

    public void setChallanBill(Bill b) {
        challanBill = b;
    }

    /** Cancel by a person (reason chosen on screen) or by the 6:00 AM job (auto = true). */
    public void cancel(String reason, boolean auto, Instant now) {
        status = BookingStatus.CANCELLED;
        cancelReason = reason;
        cancelledAt = now;
        autoCancelled = auto;
    }

    /** "Cancel & reschedule": this booking is cancelled and points to the new one. */
    public void cancelAndReschedule(Booking next, String reason, Instant now) {
        cancel(reason, false, now);
        rescheduledTo = next;
    }

    public String getCancelReason() {
        return cancelReason;
    }

    public Instant getCancelledAt() {
        return cancelledAt;
    }

    public boolean isAutoCancelled() {
        return autoCancelled;
    }

    public Booking getRescheduledTo() {
        return rescheduledTo;
    }

    public void reschedule(LocalDate date, LocalTime time, LocalDate returnDate) {
        startDate = date;
        startTime = time;
        expectedReturnDate = returnDate;
    }
}
