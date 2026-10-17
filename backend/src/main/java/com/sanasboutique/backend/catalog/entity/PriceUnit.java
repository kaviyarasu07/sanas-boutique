package com.sanasboutique.backend.catalog.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * What a Service's price means - "Flat", "Per Day", "Per Hour", "Per
 * Meter", "Per Piece"... A shared, small, admin-growable list rather than a
 * fixed enum, so a new pricing style (e.g. "Per Sq Ft") is just a new row,
 * not a code change.
 */
@Entity
@Table(name = "price_unit")
public class PriceUnit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String name;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected PriceUnit() {
        // JPA
    }

    public PriceUnit(String name) {
        this.name = name;
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }
}
