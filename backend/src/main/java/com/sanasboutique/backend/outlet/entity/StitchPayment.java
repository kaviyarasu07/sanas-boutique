package com.sanasboutique.backend.outlet.entity;

import com.sanasboutique.backend.user.AppUser;

import jakarta.persistence.*;

import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Money on a stitching order outside its bills. ADVANCE: taken before delivery, used up by delivery
 * bills in order (Bill.advancePaid). REFUND: settles leftover advance; amount is returned to the
 * customer, keptAmount is kept by the shop (reported as "Cancellation charges"). The money itself is
 * handled by hand; this only records it. Never changed after it is saved (except the refund number,
 * set once right after insert).
 */
@Entity
@Table(name = "stitch_payment")
public class StitchPayment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "outlet_id", nullable = false)
    private Outlet outlet;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private StitchOrder order;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StitchPaymentKind kind;

    @Column(nullable = false)
    private BigDecimal amount;

    @Column(name = "kept_amount")
    private BigDecimal keptAmount;

    /** Printed on the refund challan; derived from the id, so set right after the first insert. */
    @Column(name = "refund_number", unique = true)
    private String refundNumber;

    private String reason;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private AppUser user;

    @Column(name = "author_name", nullable = false)
    private String authorName;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected StitchPayment() {}

    private StitchPayment(
            StitchOrder order,
            StitchPaymentKind kind,
            BigDecimal amount,
            AppUser user,
            String authorName) {
        this.outlet = order.getOutlet();
        this.order = order;
        this.kind = kind;
        this.amount = amount;
        this.user = user;
        this.authorName = authorName;
    }

    public static StitchPayment advance(
            StitchOrder order, BigDecimal amount, AppUser user, String authorName) {
        return new StitchPayment(order, StitchPaymentKind.ADVANCE, amount, user, authorName);
    }

    /** returned: handed back to the customer; kept: kept by the shop. */
    public static StitchPayment refund(
            StitchOrder order,
            BigDecimal returned,
            BigDecimal kept,
            String reason,
            AppUser user,
            String authorName) {
        StitchPayment p =
                new StitchPayment(order, StitchPaymentKind.REFUND, returned, user, authorName);
        p.keptAmount = kept;
        p.reason = reason;
        return p;
    }

    public Long getId() {
        return id;
    }

    public StitchOrder getOrder() {
        return order;
    }

    public StitchPaymentKind getKind() {
        return kind;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public BigDecimal getKeptAmount() {
        return keptAmount;
    }

    public String getRefundNumber() {
        return refundNumber;
    }

    public void setRefundNumber(String n) {
        refundNumber = n;
    }

    public String getReason() {
        return reason;
    }

    public String getAuthorName() {
        return authorName;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
