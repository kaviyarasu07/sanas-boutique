package com.sanasboutique.backend.catalog.entity;


import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/** One item, many photos. Stored as URLs for now - real file upload/storage is a later enhancement. */
@Entity
@Table(name = "service_item_image")
public class ServiceItemImage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "item_id", nullable = false)
    private ServiceItem item;

    @Column(name = "image_url", nullable = false, length = 500)
    private String imageUrl;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected ServiceItemImage() {
        // JPA
    }

    public ServiceItemImage(ServiceItem item, String imageUrl, int sortOrder) {
        this.item = item;
        this.imageUrl = imageUrl;
        this.sortOrder = sortOrder;
    }

    public Long getId() {
        return id;
    }

    public ServiceItem getItem() {
        return item;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public int getSortOrder() {
        return sortOrder;
    }
}
