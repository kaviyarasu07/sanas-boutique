package com.sanasboutique.backend.outlet.entity;

import jakarta.persistence.*;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(
        name = "outlet_customer",
        uniqueConstraints = @UniqueConstraint(columnNames = {"outlet_id", "mobile_number"}))
public class OutletCustomer {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "outlet_id", nullable = false)
    private Outlet outlet;

    @Column(name = "mobile_number", nullable = false, length = 10)
    private String mobileNumber;

    @Column(nullable = false, length = 150)
    private String name;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected OutletCustomer() {}

    public OutletCustomer(Outlet o, String mobile, String n) {
        outlet = o;
        mobileNumber = mobile;
        name = n;
    }

    public Long getId() {
        return id;
    }

    public String getMobileNumber() {
        return mobileNumber;
    }

    public String getName() {
        return name;
    }

    public java.time.Instant getCreatedAt() {
        return createdAt;
    }

    public void setName(String n) {
        name = n;
    }
}
