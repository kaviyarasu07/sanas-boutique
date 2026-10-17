package com.sanasboutique.backend.catalog.repository;

import com.sanasboutique.backend.catalog.entity.PriceUnit;

import org.springframework.data.jpa.repository.JpaRepository;

public interface PriceUnitRepository extends JpaRepository<PriceUnit, Long> {

    boolean existsByNameIgnoreCase(String name);
}
