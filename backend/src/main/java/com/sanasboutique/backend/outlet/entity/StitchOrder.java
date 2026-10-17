package com.sanasboutique.backend.outlet.entity;

import jakarta.persistence.*;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.*;
import java.util.*;

@Entity
@Table(name = "stitch_order")
public class StitchOrder {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "outlet_id", nullable = false)
    private Outlet outlet;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id")
    private OutletCustomer customer;

    @Column(name = "order_number", nullable = false, unique = true)
    private String orderNumber;

    @Column(name = "customer_name", nullable = false)
    private String customerName;

    @Column(name = "customer_mobile", nullable = false)
    private String customerMobile;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StitchStatus status = StitchStatus.OPEN;

    /** Legacy (before V17): delivery dates live on each garment now. Still filled until the service moves to garment dates. */
    @Column(name = "estimated_delivery_date")
    private LocalDate estimatedDeliveryDate;

    private String notes;

    @Column(name = "ready_at")
    private Instant readyAt;

    @Column(name = "delivered_at")
    private Instant deliveredAt;

    /** Legacy (before V17): each delivered garment points to its own bill now (StitchItem.bill). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "bill_id")
    private Bill bill;

    @Enumerated(EnumType.STRING)
    @Column(name = "fabric_source", nullable = false)
    private FabricSource fabricSource = FabricSource.OWN;

    /** Fabric bought at the shop for this order (optional). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "fabric_bill_id")
    private Bill fabricBill;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id")
    private List<StitchItem> items = new ArrayList<>();

    protected StitchOrder() {}

    public StitchOrder(Outlet outlet, OutletCustomer customer, LocalDate delivery, String notes) {
        this.outlet = outlet;
        this.customer = customer;
        customerName = customer.getName();
        customerMobile = customer.getMobileNumber();
        estimatedDeliveryDate = delivery;
        this.notes = notes;
        orderNumber = "TEMP-" + UUID.randomUUID();
    }

    public Long getId() {
        return id;
    }

    public Outlet getOutlet() {
        return outlet;
    }

    public OutletCustomer getCustomer() {
        return customer;
    }

    public String getOrderNumber() {
        return orderNumber;
    }

    public void setOrderNumber(String n) {
        orderNumber = n;
    }

    public String getCustomerName() {
        return customerName;
    }

    public String getCustomerMobile() {
        return customerMobile;
    }

    public StitchStatus getStatus() {
        return status;
    }

    public void setStatus(StitchStatus s) {
        status = s;
    }

    public LocalDate getEstimatedDeliveryDate() {
        return estimatedDeliveryDate;
    }

    public String getNotes() {
        return notes;
    }

    public void update(LocalDate delivery, String notes) {
        estimatedDeliveryDate = delivery;
        this.notes = notes;
    }

    public Instant getReadyAt() {
        return readyAt;
    }

    public void setReadyAt(Instant t) {
        readyAt = t;
    }

    public Instant getDeliveredAt() {
        return deliveredAt;
    }

    public void setDeliveredAt(Instant t) {
        deliveredAt = t;
    }

    public Bill getBill() {
        return bill;
    }

    public void setBill(Bill b) {
        bill = b;
    }

    public Bill getFabricBill() {
        return fabricBill;
    }

    public void setFabricBill(Bill b) {
        fabricBill = b;
    }

    public FabricSource getFabricSource() {
        return fabricSource;
    }

    /** The bill (if any) must belong to an in-house purchase. */
    public void setFabric(FabricSource source, Bill bill) {
        fabricSource = bill != null ? FabricSource.IN_HOUSE : source;
        fabricBill = bill;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public List<StitchItem> getItems() {
        return items;
    }
}
