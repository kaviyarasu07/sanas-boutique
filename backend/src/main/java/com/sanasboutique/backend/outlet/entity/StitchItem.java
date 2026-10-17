package com.sanasboutique.backend.outlet.entity;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.*;

/**
 * One garment of a stitching order, with its own delivery date and status. amount (the price) is
 * optional until the garment is billed. bill is the delivery bill that billed it (partial delivery:
 * garments of one order can be on different bills). measuredOn is when the measurements were taken
 * (kept when they are copied from an earlier order).
 */
@Entity
@Table(name = "stitch_item")
public class StitchItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private StitchOrder order;

    @Column(nullable = false)
    private String garment;

    private String measurements;
    private String notes;
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StitchItemStatus status = StitchItemStatus.NOT_STARTED;

    @Column(name = "estimated_delivery_date", nullable = false)
    private LocalDate estimatedDeliveryDate;

    @Column(name = "measured_on")
    private LocalDate measuredOn;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "finished_at")
    private Instant finishedAt;

    @Column(name = "delivered_at")
    private Instant deliveredAt;

    @Column(name = "cancelled_at")
    private Instant cancelledAt;

    @Column(name = "cancel_reason")
    private String cancelReason;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "bill_id")
    private Bill bill;

    protected StitchItem() {}

    public StitchItem(
            StitchOrder o,
            String garment,
            String measurements,
            String notes,
            LocalDate estimatedDeliveryDate,
            LocalDate measuredOn) {
        order = o;
        this.garment = garment;
        this.measurements = measurements;
        this.notes = notes;
        this.estimatedDeliveryDate = estimatedDeliveryDate;
        this.measuredOn = measuredOn;
    }

    public Long getId() {
        return id;
    }

    public StitchOrder getOrder() {
        return order;
    }

    public String getGarment() {
        return garment;
    }

    public String getMeasurements() {
        return measurements;
    }

    public String getNotes() {
        return notes;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal a) {
        amount = a;
    }

    public void update(String garment, String measurements, String notes) {
        this.garment = garment;
        this.measurements = measurements;
        this.notes = notes;
    }

    public StitchItemStatus getStatus() {
        return status;
    }

    /** Staff-set progress (Not started / Started / Finished); the caller checks the garment is still open. */
    public void setProgress(StitchItemStatus s, Instant now) {
        if (!s.isOpen()) throw new IllegalArgumentException("Use deliver or cancel to close a garment");
        status = s;
        if (s == StitchItemStatus.STARTED && startedAt == null) startedAt = now;
        finishedAt = s == StitchItemStatus.FINISHED ? now : null;
    }

    public void deliver(Bill b, Instant now) {
        status = StitchItemStatus.DELIVERED;
        bill = b;
        deliveredAt = now;
    }

    public void cancel(String reason, Instant now) {
        status = StitchItemStatus.CANCELLED;
        cancelReason = reason;
        cancelledAt = now;
    }

    public LocalDate getEstimatedDeliveryDate() {
        return estimatedDeliveryDate;
    }

    public void setEstimatedDeliveryDate(LocalDate d) {
        estimatedDeliveryDate = d;
    }

    public LocalDate getMeasuredOn() {
        return measuredOn;
    }

    public void setMeasuredOn(LocalDate d) {
        measuredOn = d;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public Instant getFinishedAt() {
        return finishedAt;
    }

    public Instant getDeliveredAt() {
        return deliveredAt;
    }

    public Instant getCancelledAt() {
        return cancelledAt;
    }

    public String getCancelReason() {
        return cancelReason;
    }

    public Bill getBill() {
        return bill;
    }
}
