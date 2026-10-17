package com.sanasboutique.backend.outlet.entity;

import com.sanasboutique.backend.common.OutletModule;

import jakarta.persistence.*;

import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "bill")
public class Bill {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "outlet_id", nullable = false)
    private Outlet outlet;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id")
    private OutletCustomer customer;

    @Column(name = "bill_number", nullable = false, unique = true)
    private String billNumber;

    @Column(name = "customer_name", nullable = false)
    private String customerName;

    @Column(name = "customer_mobile", nullable = false)
    private String customerMobile;

    @Column(nullable = false)
    private BigDecimal discount;

    @Column(nullable = false)
    private BigDecimal subtotal;

    @Column(nullable = false)
    private BigDecimal total;

    @Enumerated(EnumType.STRING)
    @Column(name = "bill_type", nullable = false)
    private BillType billType = BillType.BILL;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OutletModule module = OutletModule.SALES;

    /** Set only when module = CUSTOM: the franchisor-created billing module this bill belongs to. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "billing_module_id")
    private com.sanasboutique.backend.catalog.entity.BillingModule billingModule;

    /** Old bill (before modules) that mixed items of several modules; filed under SALES. */
    @Column(name = "legacy_mixed", nullable = false)
    private boolean legacyMixed;

    /** Stitching: advance used on this bill. Balance to pay = total - advancePaid. */
    @Column(name = "advance_paid", nullable = false)
    private BigDecimal advancePaid = BigDecimal.ZERO;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @OneToMany(mappedBy = "bill", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<BillItem> items = new ArrayList<>();

    protected Bill() {}

    public Bill(
            Outlet outlet,
            String billNumber,
            String customerName,
            String customerMobile,
            BigDecimal discount,
            BigDecimal subtotal,
            BigDecimal total) {
        this.outlet = outlet;
        this.billNumber = billNumber;
        this.customerName = customerName;
        this.customerMobile = customerMobile;
        this.discount = discount;
        this.subtotal = subtotal;
        this.total = total;
    }

    public Long getId() {
        return id;
    }

    public Outlet getOutlet() {
        return outlet;
    }

    public String getBillNumber() {
        return billNumber;
    }

    public void setBillNumber(String n) {
        billNumber = n;
    }

    public void setCustomer(OutletCustomer c) {
        customer = c;
    }

    public String getCustomerName() {
        return customerName;
    }

    public String getCustomerMobile() {
        return customerMobile;
    }

    public BigDecimal getDiscount() {
        return discount;
    }

    public BigDecimal getSubtotal() {
        return subtotal;
    }

    public BigDecimal getTotal() {
        return total;
    }

    public BillType getBillType() {
        return billType;
    }

    public void setBillType(BillType t) {
        billType = t;
    }

    public OutletModule getModule() {
        return module;
    }

    public void setModule(OutletModule m) {
        module = m;
    }

    public com.sanasboutique.backend.catalog.entity.BillingModule getBillingModule() {
        return billingModule;
    }

    /** File this bill under a franchisor-created billing module. */
    public void setBillingModule(com.sanasboutique.backend.catalog.entity.BillingModule m) {
        module = OutletModule.CUSTOM;
        billingModule = m;
    }

    public boolean isLegacyMixed() {
        return legacyMixed;
    }

    public BigDecimal getAdvancePaid() {
        return advancePaid;
    }

    public void setAdvancePaid(BigDecimal a) {
        advancePaid = a;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public List<BillItem> getItems() {
        return items;
    }
}
