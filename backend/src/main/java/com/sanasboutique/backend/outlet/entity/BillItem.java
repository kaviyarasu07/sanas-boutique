package com.sanasboutique.backend.outlet.entity;

import com.sanasboutique.backend.catalog.entity.ServiceItem;

import jakarta.persistence.*;

import lombok.Builder;

import java.math.BigDecimal;

@Entity
@Table(name = "bill_item")
public class BillItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "bill_id", nullable = false)
    private Bill bill;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "service_item_id")
    private ServiceItem serviceItem;

    @Column(name = "service_label")
    private String serviceLabel;

    @Column(name = "item_name", nullable = false)
    private String itemName;

    @Column(name = "item_code")
    private String itemCode;

    @Column(name = "unit_price", nullable = false)
    private BigDecimal unitPrice;

    @Column(nullable = false)
    private Integer quantity;

    @Column(name = "line_total", nullable = false)
    private BigDecimal lineTotal;

    @Enumerated(EnumType.STRING)
    @Column(name = "line_type", nullable = false)
    private BillLineType lineType = BillLineType.ITEM;

    /** Rental line: quantity is the number of days, unit price the per-day price; label is appended to the item name. */
    public BillItem(Bill b, ServiceItem i, int q, String label) {
        this(b, i, q);
        itemName = i.getName() + label;
    }

    /** As above with an explicit unit price (null = the item price); a zero price makes a challan line. */
    public BillItem(Bill b, ServiceItem i, int q, String label, java.math.BigDecimal price) {
        this(b, i, q, label);
        if (price != null) {
            unitPrice = price;
            lineTotal = price.multiply(java.math.BigDecimal.valueOf(q));
        }
    }

    /** A line with no catalog item (e.g. stitching): its own name, service label and amount. */
    public BillItem(Bill b, String name, String serviceLabel, java.math.BigDecimal price, int q) {
        bill = b;
        itemName = name;
        this.serviceLabel = serviceLabel;
        unitPrice = price;
        quantity = q;
        lineTotal = price.multiply(java.math.BigDecimal.valueOf(q));
        lineType = BillLineType.CUSTOM;
    }

    protected BillItem() {}

    public BillItem(Bill b, ServiceItem i, int q) {
        bill = b;
        serviceItem = i;
        itemName = i.getName();
        itemCode = i.getItemCode();
        unitPrice = i.getPrice();
        quantity = q;
        lineTotal = i.getPrice().multiply(BigDecimal.valueOf(q));
    }

    public String getItemName() {
        return itemName;
    }

    public String getItemCode() {
        return itemCode;
    }

    public BigDecimal getUnitPrice() {
        return unitPrice;
    }

    public Integer getQuantity() {
        return quantity;
    }

    public BigDecimal getLineTotal() {
        return lineTotal;
    }

    public BillLineType getLineType() {
        return lineType;
    }

    public void setLineType(BillLineType t) {
        lineType = t;
    }
}
