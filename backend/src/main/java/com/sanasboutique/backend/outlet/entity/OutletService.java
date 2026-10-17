package com.sanasboutique.backend.outlet.entity;

import com.sanasboutique.backend.catalog.entity.CatalogService;

import jakarta.persistence.*;

@Entity
@Table(
        name = "outlet_service",
        uniqueConstraints = @UniqueConstraint(columnNames = {"outlet_id", "service_id"}))
public class OutletService {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "outlet_id", nullable = false)
    private Outlet outlet;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "service_id", nullable = false)
    private CatalogService service;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    protected OutletService() {}

    public OutletService(Outlet o, CatalogService s) {
        outlet = o;
        service = s;
    }

    public CatalogService getService() {
        return service;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean v) {
        active = v;
    }
}
