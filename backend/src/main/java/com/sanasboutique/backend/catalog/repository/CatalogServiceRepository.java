package com.sanasboutique.backend.catalog.repository;

import com.sanasboutique.backend.catalog.entity.CatalogService;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CatalogServiceRepository extends JpaRepository<CatalogService, Long> {
    long countByBillingModuleId(Long billingModuleId);


    boolean existsByNameIgnoreCase(String name);

    /** Service responses include the price-unit fields after the repository session closes. */
    @Override
    @EntityGraph(attributePaths = "priceUnit")
    List<CatalogService> findAll();

    @Override
    @EntityGraph(attributePaths = "priceUnit")
    Optional<CatalogService> findById(Long id);
}
