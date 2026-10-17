package com.sanasboutique.backend.catalog.entity;


import com.sanasboutique.backend.common.OutletModule;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

/**
 * A business line the franchise offers - "Jewelry Rental", "Parlor",
 * "Fabric Stitching", "Fabric Sales", and anything added later. Named
 * CatalogService (not "Service") to avoid clashing with Spring's own
 * @Service stereotype annotation. Maps to the "service" table.
 *
 * Pricing style (priceUnit) is fixed per service - every ServiceItem under
 * it shares the same unit - confirmed with the client as the right level
 * for this; if that ever needs to move to the category, it's a small,
 * isolated change (move the column, update two classes).
 */
@Entity
@Table(name = "service")
public class CatalogService {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 150)
    private String name;

    @Column(length = 255)
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "price_unit_id", nullable = false)
    private PriceUnit priceUnit;

    /** RENTAL, APPOINTMENT, DELIVERY or NONE; null = decide automatically from the price unit and stock tracking. */
    @Column(name = "booking_mode", length = 20)
    private String bookingMode;

    /** Whether items of this service can be pre-booked at an outlet. */
    @Column(name = "prebook_enabled", nullable = false)
    private boolean prebookEnabled;

    /** The outlet module this service opens (RENTAL, PARLOUR, STITCHING or SALES). Replaces bookingMode / prebookEnabled, which are kept only until the app stops reading them. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private OutletModule module = OutletModule.SALES;

    /** Set only when module = CUSTOM: the franchisor-created billing module this service is billed in. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "billing_module_id")
    private BillingModule billingModule;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected CatalogService() {
        // JPA
    }

    public CatalogService(String name, String description, PriceUnit priceUnit) {
        this.name = name;
        this.description = description;
        this.priceUnit = priceUnit;
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public PriceUnit getPriceUnit() {
        return priceUnit;
    }

    public void setPriceUnit(PriceUnit priceUnit) {
        this.priceUnit = priceUnit;
    }

    public OutletModule getModule() {
        return module;
    }

    /** The outlet module this service opens: Jewellery rental, Parlour, Stitching or Shop sales. */
    /** A built-in module (Jewellery rental, Parlour, Stitching, Shop sales). Use setBillingModule for a franchisor-created one. */
    public void setModule(OutletModule module) {
        if (module == null) throw new IllegalArgumentException("Choose the module of this service");
        if (module == OutletModule.CUSTOM) throw new IllegalArgumentException("Choose which billing module");
        this.module = module;
        this.billingModule = null;
    }

    /** Put this service in a franchisor-created billing module (module becomes CUSTOM). */
    public void setBillingModule(BillingModule billingModule) {
        if (billingModule == null) throw new IllegalArgumentException("Choose which billing module");
        this.module = OutletModule.CUSTOM;
        this.billingModule = billingModule;
    }

    public BillingModule getBillingModule() {
        return billingModule;
    }

    public boolean isPrebookEnabled() {
        return prebookEnabled;
    }

    public void setPrebookEnabled(boolean prebookEnabled) {
        this.prebookEnabled = prebookEnabled;
    }

    public String getBookingMode() {
        return bookingMode;
    }

    public void setBookingMode(String bookingMode) {
        this.bookingMode = bookingMode;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }
}
