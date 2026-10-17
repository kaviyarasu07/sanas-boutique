package com.sanasboutique.backend.outlet.entity;

import com.sanasboutique.backend.catalog.entity.ServiceItem;

import jakarta.persistence.*;

import java.math.BigDecimal;

/**
 * One piece (or several of the same code) on a booking. addedQty: how many of quantity were added at
 * hand-over. The return fields stay null until the rental comes back; then ok + damaged + missing =
 * quantity, and repairQty (part of damagedQty) went for repair instead of back to stock.
 */
@Entity
@Table(name = "booking_item")
public class BookingItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id", nullable = false)
    private Booking booking;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "service_item_id", nullable = false)
    private ServiceItem serviceItem;

    @Column(nullable = false)
    private int quantity = 1;

    @Column(name = "added_qty", nullable = false)
    private int addedQty;

    @Column(name = "ok_qty")
    private Integer okQty;

    @Column(name = "damaged_qty")
    private Integer damagedQty;

    @Column(name = "repair_qty")
    private Integer repairQty;

    @Column(name = "missing_qty")
    private Integer missingQty;

    @Column(name = "damage_charge")
    private BigDecimal damageCharge;

    @Column(name = "missing_charge")
    private BigDecimal missingCharge;

    @Column(name = "damage_note")
    private String damageNote;

    protected BookingItem() {}

    public BookingItem(Booking b, ServiceItem i, int quantity) {
        booking = b;
        serviceItem = i;
        this.quantity = quantity;
    }

    public ServiceItem getServiceItem() {
        return serviceItem;
    }

    public int getQuantity() {
        return quantity;
    }

    public int getAddedQty() {
        return addedQty;
    }

    /** More of this piece taken at hand-over. */
    public void addAtHandOver(int n) {
        quantity += n;
        addedQty += n;
    }

    /** What came back at return; the caller has validated the counts and moved the stock. */
    public void recordReturn(
            int ok,
            int damaged,
            int repair,
            int missing,
            BigDecimal damageCharge,
            String damageNote,
            BigDecimal missingCharge) {
        okQty = ok;
        damagedQty = damaged;
        repairQty = repair;
        missingQty = missing;
        this.damageCharge = damageCharge;
        this.damageNote = damageNote;
        this.missingCharge = missingCharge;
    }

    public Integer getOkQty() {
        return okQty;
    }

    public Integer getDamagedQty() {
        return damagedQty;
    }

    public Integer getRepairQty() {
        return repairQty;
    }

    public Integer getMissingQty() {
        return missingQty;
    }

    public BigDecimal getDamageCharge() {
        return damageCharge;
    }

    public BigDecimal getMissingCharge() {
        return missingCharge;
    }

    public String getDamageNote() {
        return damageNote;
    }
}
