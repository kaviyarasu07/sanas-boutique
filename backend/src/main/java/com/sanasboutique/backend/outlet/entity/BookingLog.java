package com.sanasboutique.backend.outlet.entity;

import com.sanasboutique.backend.user.AppUser;

import jakarta.persistence.*;

import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * One line in a booking's timeline: an automatic step (booked, edited, done, cancelled,
 * rescheduled, cancelled by the 6:00 AM job) or a staff comment. Append-only: no setters, and the
 * app never updates or deletes rows. user is null for the system job (authorName "System").
 */
@Entity
@Table(name = "booking_log")
public class BookingLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "outlet_id", nullable = false)
    private Outlet outlet;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id", nullable = false)
    private Booking booking;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private BookingLogKind kind;

    @Column(nullable = false)
    private String message;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private AppUser user;

    @Column(name = "author_name", nullable = false)
    private String authorName;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected BookingLog() {}

    public BookingLog(
            Booking booking, BookingLogKind kind, String message, AppUser user, String authorName) {
        this.outlet = booking.getOutlet();
        this.booking = booking;
        this.kind = kind;
        this.message = message;
        this.user = user;
        this.authorName = authorName;
    }

    public Long getId() {
        return id;
    }

    public BookingLogKind getKind() {
        return kind;
    }

    public String getMessage() {
        return message;
    }

    public String getAuthorName() {
        return authorName;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
