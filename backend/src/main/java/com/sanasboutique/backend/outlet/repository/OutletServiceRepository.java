package com.sanasboutique.backend.outlet.repository;

import com.sanasboutique.backend.outlet.entity.OutletService;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.*;

public interface OutletServiceRepository extends JpaRepository<OutletService, Long> {
    List<OutletService> findByOutletId(Long outletId);

    Optional<OutletService> findByOutletIdAndServiceId(Long outletId, Long serviceId);

    @Modifying
    @Query("update OutletService a set a.active = false where a.service.id = :serviceId")
    int disableForService(@Param("serviceId") Long serviceId);
}
