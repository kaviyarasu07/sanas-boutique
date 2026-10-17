package com.sanasboutique.backend.outlet.entity;

import com.sanasboutique.backend.user.AppUser;

import jakarta.persistence.*;

import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * One line in a stitching order's timeline: an automatic step (created, status, edit, advance, date,
 * delivered, cancelled, refund) or a staff comment. Append-only: no setters, and the app never
 * updates or deletes rows. authorName keeps the name as it was at the time. Never printed on bills;
 * comments are shown on the work slip.
 */
@Entity
@Table(name = "stitch_order_log")
public class StitchOrderLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "outlet_id", nullable = false)
    private Outlet outlet;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private StitchOrder order;

    /** The garment this line is about, if any. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "item_id")
    private StitchItem item;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StitchLogKind kind;

    @Column(nullable = false)
    private String message;

    @Column(name = "from_value")
    private String fromValue;

    @Column(name = "to_value")
    private String toValue;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private AppUser user;

    @Column(name = "author_name", nullable = false)
    private String authorName;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected StitchOrderLog() {}

    public StitchOrderLog(
            StitchOrder order,
            StitchItem item,
            StitchLogKind kind,
            String message,
            String fromValue,
            String toValue,
            AppUser user,
            String authorName) {
        this.outlet = order.getOutlet();
        this.order = order;
        this.item = item;
        this.kind = kind;
        this.message = message;
        this.fromValue = fromValue;
        this.toValue = toValue;
        this.user = user;
        this.authorName = authorName;
    }

    public Long getId() {
        return id;
    }

    public StitchItem getItem() {
        return item;
    }

    public StitchLogKind getKind() {
        return kind;
    }

    public String getMessage() {
        return message;
    }

    public String getFromValue() {
        return fromValue;
    }

    public String getToValue() {
        return toValue;
    }

    public String getAuthorName() {
        return authorName;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
