package com.sanasboutique.backend.outlet.repository;

import com.sanasboutique.backend.outlet.entity.ItemRepair;
import com.sanasboutique.backend.outlet.entity.RepairStatus;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/** Damaged rental pieces sent for repair; always scoped to one outlet. */
public interface ItemRepairRepository extends JpaRepository<ItemRepair, Long> {
    List<ItemRepair> findByOutletIdAndStatusOrderBySentOnAscIdAsc(Long outletId, RepairStatus status);

    Optional<ItemRepair> findByIdAndOutletId(Long id, Long outletId);

    long countByOutletIdAndStatus(Long outletId, RepairStatus status);
}
