package com.sanasboutique.backend.outlet.repository;

import com.sanasboutique.backend.outlet.entity.*;

import jakarta.persistence.LockModeType;

import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.*;

public interface StitchOrderRepository extends JpaRepository<StitchOrder, Long> {
    Optional<StitchOrder> findByIdAndOutletId(Long id, Long outletId);

    /** Same, locking the order row: money and delivery changes run one at a time per order. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from StitchOrder o where o.id = :id and o.outlet.id = :outletId")
    Optional<StitchOrder> findForUpdate(@Param("id") Long id, @Param("outletId") Long outletId);

    Optional<StitchOrder> findByOrderNumberIgnoreCaseAndOutletId(String orderNumber, Long outletId);

    /** Orders in the given statuses matching order number, customer name or mobile; readyOnly keeps orders with at least one finished garment. */
    @Query(
            "select o from StitchOrder o where o.outlet.id = :outletId and o.status in :statuses"
                + " and (:readyOnly = false or exists (select i from StitchItem i where i.order = o"
                + " and i.status = com.sanasboutique.backend.outlet.entity.StitchItemStatus.FINISHED))"
                + " and (lower(o.orderNumber) like lower(concat('%', :search, '%')) or"
                + " lower(o.customerName) like lower(concat('%', :search, '%')) or o.customerMobile"
                + " like concat('%', :search, '%'))")
    Page<StitchOrder> search(
            @Param("outletId") Long outletId,
            @Param("statuses") Collection<StitchStatus> statuses,
            @Param("readyOnly") boolean readyOnly,
            @Param("search") String search,
            Pageable pageable);
}
