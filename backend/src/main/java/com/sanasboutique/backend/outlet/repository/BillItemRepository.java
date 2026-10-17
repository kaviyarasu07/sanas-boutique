package com.sanasboutique.backend.outlet.repository;

import com.sanasboutique.backend.outlet.entity.BillItem;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface BillItemRepository extends JpaRepository<BillItem, Long> {
    /** Sales per service in [start, end), best first, across all outlets. Rows: serviceId, name, sales, units. Line totals are before any bill-level discount. */
    @Query(
            "select coalesce(s.id, 0L), coalesce(s.name, i.serviceLabel, 'Other'),"
                + " sum(i.lineTotal), sum(i.quantity) from BillItem i join i.bill b left join"
                + " i.serviceItem si left join si.service s where b.createdAt >= :start and"
                + " b.createdAt < :end group by coalesce(s.id, 0L), coalesce(s.name,"
                + " i.serviceLabel, 'Other') order by sum(i.lineTotal) desc")
    List<Object[]> serviceSalesForAll(@Param("start") Instant start, @Param("end") Instant end);

    @Query(
            "select coalesce(s.id, 0L), coalesce(s.name, i.serviceLabel, 'Other'),"
                + " sum(i.lineTotal), sum(i.quantity) from BillItem i join i.bill b left join"
                + " i.serviceItem si left join si.service s where b.outlet.id = :outletId and"
                + " b.createdAt >= :start and b.createdAt < :end group by coalesce(s.id, 0L),"
                + " coalesce(s.name, i.serviceLabel, 'Other') order by sum(i.lineTotal) desc")
    List<Object[]> serviceSalesForOutlet(
            @Param("outletId") Long outletId,
            @Param("start") Instant start,
            @Param("end") Instant end);

    /** Report rows: createdAt, billNumber, outletName, customerName, customerMobile, serviceId, serviceName, itemName, itemCode, quantity, unitPrice, lineTotal, billId. Callers pass a placeholder id when a list filter is unused. */
    @Query(
            "select b.createdAt, b.billNumber, o.name, b.customerName, b.customerMobile,"
                + " coalesce(s.id, 0L), coalesce(s.name, i.serviceLabel, 'Other'), i.itemName,"
                + " i.itemCode, i.quantity, i.unitPrice, i.lineTotal, b.id from BillItem i join"
                + " i.bill b join b.outlet o left join i.serviceItem si left join si.service s"
                + " where b.createdAt >= :start and b.createdAt < :end and (:allOutlets = true or"
                + " o.id in :outletIds) and (:allServices = true or s.id in :serviceIds) order by"
                + " b.createdAt desc, b.id desc, i.id asc")
    List<Object[]> reportRows(
            @Param("start") Instant start,
            @Param("end") Instant end,
            @Param("allOutlets") boolean allOutlets,
            @Param("outletIds") java.util.Collection<Long> outletIds,
            @Param("allServices") boolean allServices,
            @Param("serviceIds") java.util.Collection<Long> serviceIds,
            org.springframework.data.domain.Pageable limit);
}
