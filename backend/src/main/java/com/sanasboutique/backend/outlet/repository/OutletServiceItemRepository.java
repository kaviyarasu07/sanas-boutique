package com.sanasboutique.backend.outlet.repository;

import com.sanasboutique.backend.outlet.entity.OutletServiceItem;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.*;

public interface OutletServiceItemRepository extends JpaRepository<OutletServiceItem, Long> {
    List<OutletServiceItem> findByOutletId(Long outletId);

    Optional<OutletServiceItem> findByOutletIdAndServiceItemId(Long outletId, Long serviceItemId);

    /** Row-locked variant used while billing so concurrent bills cannot oversell stock. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query(
            "select a from OutletServiceItem a where a.outlet.id = :outletId and a.serviceItem.id ="
                + " :itemId")
    Optional<OutletServiceItem> findForUpdate(
            @Param("outletId") Long outletId, @Param("itemId") Long itemId);
}
