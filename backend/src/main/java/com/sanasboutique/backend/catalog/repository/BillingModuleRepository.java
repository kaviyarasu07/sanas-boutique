package com.sanasboutique.backend.catalog.repository;

import com.sanasboutique.backend.catalog.entity.BillingModule;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BillingModuleRepository extends JpaRepository<BillingModule, Long> {
    List<BillingModule> findAllByOrderByNameAsc();

    boolean existsByCode(String code);

    boolean existsByNameIgnoreCase(String name);
}
