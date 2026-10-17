package com.sanasboutique.backend.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "app_user")
public class AppUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Null only for FRANCHISOR. Every other role must have one. */
    @Column(name = "franchise_id")
    private Long franchiseId;

    @Column(nullable = false, unique = true, length = 50)
    private String username;

    @Column(name = "mobile_no", nullable = false, unique = true, length = 15)
    private String mobileNo;

    @Column(name = "password_hash", nullable = false, length = 100)
    private String passwordHash;

    @Column(name = "full_name", nullable = false, length = 150)
    private String fullName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private Role role;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @Column(name = "password_change_required", nullable = false)
    private boolean passwordChangeRequired;

    @Column(name = "password_changed_at")
    private Instant passwordChangedAt;

    @Column(name = "reset_otp_hash", length = 100)
    private String resetOtpHash;

    @Column(name = "reset_otp_expires_at")
    private Instant resetOtpExpiresAt;

    @Column(name = "reset_otp_attempts", nullable = false)
    private int resetOtpAttempts;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected AppUser() {
        // JPA
    }

    public AppUser(
            Long franchiseId,
            String username,
            String mobileNo,
            String passwordHash,
            String fullName,
            Role role) {
        this.franchiseId = franchiseId;
        this.username = username;
        this.mobileNo = mobileNo;
        this.passwordHash = passwordHash;
        this.fullName = fullName;
        this.role = role;
    }

    public Long getId() {
        return id;
    }

    public Long getFranchiseId() {
        return franchiseId;
    }

    public String getUsername() {
        return username;
    }

    public String getMobileNo() {
        return mobileNo;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public String getFullName() {
        return fullName;
    }

    public Role getRole() {
        return role;
    }

    public boolean isActive() {
        return active;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public boolean isPasswordChangeRequired() {
        return passwordChangeRequired;
    }

    public Instant getPasswordChangedAt() {
        return passwordChangedAt;
    }

    public String getResetOtpHash() {
        return resetOtpHash;
    }

    public Instant getResetOtpExpiresAt() {
        return resetOtpExpiresAt;
    }

    public int getResetOtpAttempts() {
        return resetOtpAttempts;
    }

    /** Admin-issued password: replaced at next login, and forgot-password stays off until then. */
    public void setSystemPassword(String hash) {
        this.passwordHash = hash;
        this.passwordChangeRequired = true;
        this.passwordChangedAt = null;
        clearResetOtp();
    }

    /** The user's own choice of password. */
    public void setUserPassword(String hash) {
        this.passwordHash = hash;
        this.passwordChangeRequired = false;
        this.passwordChangedAt = Instant.now();
        clearResetOtp();
    }

    public void setResetOtp(String hash, Instant expiresAt) {
        this.resetOtpHash = hash;
        this.resetOtpExpiresAt = expiresAt;
        this.resetOtpAttempts = 0;
    }

    public void recordFailedOtp() {
        this.resetOtpAttempts++;
    }

    public void clearResetOtp() {
        this.resetOtpHash = null;
        this.resetOtpExpiresAt = null;
        this.resetOtpAttempts = 0;
    }
}
