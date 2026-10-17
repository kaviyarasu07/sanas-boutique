package com.sanasboutique.backend.outlet.repository;

import com.sanasboutique.backend.outlet.entity.StitchItem;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

/** Garment-level lists: delivery dates and statuses live on the garment. Every query is scoped to one outlet. */
public interface StitchItemRepository extends JpaRepository<StitchItem, Long> {
    String OPEN =
            " i.status in (com.sanasboutique.backend.outlet.entity.StitchItemStatus.NOT_STARTED,"
                + " com.sanasboutique.backend.outlet.entity.StitchItemStatus.STARTED,"
                + " com.sanasboutique.backend.outlet.entity.StitchItemStatus.FINISHED)";

    /** Garments not yet delivered or cancelled that are due on the day. */
    @Query(
            "select i from StitchItem i join fetch i.order o where o.outlet.id = :outletId and"
                    + OPEN
                    + " and i.estimatedDeliveryDate = :day order by o.id, i.id")
    List<StitchItem> openDueOn(@Param("outletId") Long outletId, @Param("day") LocalDate day);

    /** Open garments whose date has passed, oldest first. */
    @Query(
            "select i from StitchItem i join fetch i.order o where o.outlet.id = :outletId and"
                    + OPEN
                    + " and i.estimatedDeliveryDate < :day order by i.estimatedDeliveryDate, o.id,"
                    + " i.id")
    List<StitchItem> openDueBefore(@Param("outletId") Long outletId, @Param("day") LocalDate day);

    /** Open garments due after the day, soonest first. */
    @Query(
            "select i from StitchItem i join fetch i.order o where o.outlet.id = :outletId and"
                    + OPEN
                    + " and i.estimatedDeliveryDate > :day order by i.estimatedDeliveryDate, o.id,"
                    + " i.id")
    List<StitchItem> openDueAfter(
            @Param("outletId") Long outletId, @Param("day") LocalDate day, Pageable limit);

    /** Every garment (not cancelled) whose delivery date is the day, delivered or not (calendar view). */
    @Query(
            "select i from StitchItem i join fetch i.order o where o.outlet.id = :outletId and"
                + " i.status <> com.sanasboutique.backend.outlet.entity.StitchItemStatus.CANCELLED"
                + " and i.estimatedDeliveryDate = :day order by o.id, i.id")
    List<StitchItem> onDay(@Param("outletId") Long outletId, @Param("day") LocalDate day);

    /** A customer's earlier measurements at this outlet, newest first. */
    @Query(
            "select i from StitchItem i join fetch i.order o where o.outlet.id = :outletId and"
                + " o.customerMobile = :mobile and i.measurements is not null order by i.measuredOn"
                + " desc nulls last, i.id desc")
    List<StitchItem> measurementsFor(
            @Param("outletId") Long outletId, @Param("mobile") String mobile, Pageable limit);
}
