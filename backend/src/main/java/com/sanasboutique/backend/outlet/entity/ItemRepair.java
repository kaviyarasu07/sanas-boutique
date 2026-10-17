package com.sanasboutique.backend.outlet.entity;

import com.sanasboutique.backend.catalog.entity.ServiceItem;

import jakarta.persistence.*;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.*;

/** Damaged pieces the outlet in-charge sent for repair at a rental return. Out of stock until marked back in stock. */
@Entity
@Table(name = "item_repair")
public class ItemRepair {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "outlet_id", nullable = false)
    private Outlet outlet;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "service_item_id", nullable = false)
    private ServiceItem serviceItem;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id")
    private Booking booking;

    @Column(nullable = false)
    private int quantity;

    private String note;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RepairStatus status = RepairStatus.UNDER_REPAIR;

    @Column(name = "sent_on", nullable = false)
    private LocalDate sentOn;

    @Column(name = "back_on")
    private LocalDate backOn;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected ItemRepair() {}

    public ItemRepair(
            Outlet outlet,
            ServiceItem serviceItem,
            Booking booking,
            int quantity,
            String note,
            LocalDate sentOn) {
        this.outlet = outlet;
        this.serviceItem = serviceItem;
        this.booking = booking;
        this.quantity = quantity;
        this.note = note;
        this.sentOn = sentOn;
    }

    public Long getId() {
        return id;
    }

    public Outlet getOutlet() {
        return outlet;
    }

    public ServiceItem getServiceItem() {
        return serviceItem;
    }

    public Booking getBooking() {
        return booking;
    }

    public int getQuantity() {
        return quantity;
    }

    public String getNote() {
        return note;
    }

    public RepairStatus getStatus() {
        return status;
    }

    public LocalDate getSentOn() {
        return sentOn;
    }

    public LocalDate getBackOn() {
        return backOn;
    }

    /** Repair done: the caller puts the quantity back into stock. */
    public void markBackInStock(LocalDate date) {
        status = RepairStatus.BACK_IN_STOCK;
        backOn = date;
    }
}
