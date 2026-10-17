package com.sanasboutique.backend.catalog.entity;

import jakarta.persistence.*;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

/**
 * A simple billing module created by the franchisor (e.g. "Bangle sales"): its own outlet menu item,
 * billing screen, bills and bill numbers (PREFIX-code-000123). Services are put in it with
 * CatalogService.module = CUSTOM. code is generated from the name and never changes once bills exist.
 */
@Entity
@Table(name = "billing_module")
public class BillingModule {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 60)
    private String name;

    @Column(nullable = false, unique = true, length = 4)
    private String code;

    /** One of the icon names the frontend offers (bag, ring, flower, gift, star, tag). */
    @Column(nullable = false, length = 20)
    private String icon;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected BillingModule() {}

    public BillingModule(String name, String code, String icon) {
        this.name = name;
        this.code = code;
        this.icon = icon;
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

    public String getCode() {
        return code;
    }

    public String getIcon() {
        return icon;
    }

    public void setIcon(String icon) {
        this.icon = icon;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }
}
