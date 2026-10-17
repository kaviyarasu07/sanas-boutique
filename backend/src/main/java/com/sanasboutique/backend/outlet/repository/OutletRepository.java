package com.sanasboutique.backend.outlet.repository;

import com.sanasboutique.backend.outlet.entity.Outlet;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OutletRepository extends JpaRepository<Outlet, Long> {
    List<Outlet> findAllByOrderByNameAsc();

    java.util.Optional<Outlet> findByFranchiseId(Long franchiseId);

    boolean existsByMobileNumber(String mobileNumber);

    boolean existsByEmailIgnoreCase(String email);
}
