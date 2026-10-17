package com.sanasboutique.backend.outlet.entity;

import com.sanasboutique.backend.catalog.entity.ServiceItem;

import jakarta.persistence.*;

@Entity
@Table(
        name = "outlet_service_item",
        uniqueConstraints = @UniqueConstraint(columnNames = {"outlet_id", "service_item_id"}))
public class OutletServiceItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "outlet_id", nullable = false)
    private Outlet outlet;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "service_item_id", nullable = false)
    private ServiceItem serviceItem;

    @Column(name = "allocated_quantity")
    private Integer allocatedQuantity;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    protected OutletServiceItem() {}

    public OutletServiceItem(Outlet o, ServiceItem i) {
        outlet = o;
        serviceItem = i;
    }

    public ServiceItem getServiceItem() {
        return serviceItem;
    }

    public Integer getAllocatedQuantity() {
        return allocatedQuantity;
    }

    public void setAllocatedQuantity(Integer v) {
        allocatedQuantity = v;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean v) {
        active = v;
    }
}
