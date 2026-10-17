package com.sanasboutique.backend.outlet.entity;

import jakarta.persistence.*;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "outlet")
public class Outlet {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "franchise_id", nullable = false, unique = true)
    private Long franchiseId;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(name = "owner_name", nullable = false, length = 150)
    private String ownerName;

    @Column(length = 500)
    private String address;

    @Column(name = "mobile_number", nullable = false, unique = true, length = 15)
    private String mobileNumber;

    @Column(nullable = false, unique = true, length = 254)
    private String email;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @Column(name = "app_user_id", nullable = false, unique = true)
    private Long appUserId;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Outlet() {}

    public Outlet(
            Long franchiseId,
            String name,
            String ownerName,
            String address,
            String mobileNumber,
            String email,
            Long appUserId) {
        this.franchiseId = franchiseId;
        this.name = name;
        this.ownerName = ownerName;
        this.address = address;
        this.mobileNumber = mobileNumber;
        this.email = email;
        this.appUserId = appUserId;
    }

    public Long getId() {
        return id;
    }

    public Long getFranchiseId() {
        return franchiseId;
    }

    public String getName() {
        return name;
    }

    public void setName(String value) {
        name = value;
    }

    public String getOwnerName() {
        return ownerName;
    }

    public void setOwnerName(String value) {
        ownerName = value;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String value) {
        address = value;
    }

    public String getMobileNumber() {
        return mobileNumber;
    }

    public void setMobileNumber(String value) {
        mobileNumber = value;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String value) {
        email = value;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean value) {
        active = value;
    }

    public Long getAppUserId() {
        return appUserId;
    }
}
