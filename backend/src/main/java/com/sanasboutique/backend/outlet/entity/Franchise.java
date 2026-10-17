package com.sanasboutique.backend.outlet.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "franchise")
public class Franchise {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true)
    private String code;

    protected Franchise() {}

    public Franchise(String name, String code) {
        this.name = name;
        this.code = code;
    }

    public Long getId() {
        return id;
    }
}
