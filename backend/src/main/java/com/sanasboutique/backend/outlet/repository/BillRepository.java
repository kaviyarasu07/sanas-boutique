package com.sanasboutique.backend.outlet.repository;

import com.sanasboutique.backend.outlet.entity.Bill;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public interface BillRepository extends JpaRepository<Bill, Long> {
    List<Bill> findTop10ByOutletIdOrderByCreatedAtDesc(Long outletId);

    List<Bill> findTop10ByOutletIdAndModuleAndBillTypeOrderByCreatedAtDesc(
            Long outletId, com.sanasboutique.backend.common.OutletModule module, com.sanasboutique.backend.outlet.entity.BillType type);

    /** Bills of one outlet in [start, end). Callers always pass concrete bounds. */
    @Query(
            "select b from Bill b where b.outlet.id = :outletId and lower(b.billNumber) like"
                + " lower(concat('%', :search, '%')) and b.createdAt >= :start and b.createdAt <"
                + " :end order by b.createdAt desc")
    Page<Bill> findForOutlet(
            @Param("outletId") Long outletId,
            @Param("search") String search,
            @Param("start") Instant start,
            @Param("end") Instant end,
            Pageable pageable);

    /** Bills of one outlet and one module in [start, end), newest first (e.g. the Parlour "Bills" screen). Challans (no amount) are not bills, so they are left out. */
    @Query(
            "select b from Bill b where b.outlet.id = :outletId and b.module = :module and b.billType ="
                + " com.sanasboutique.backend.outlet.entity.BillType.BILL and"
                + " lower(b.billNumber) like lower(concat('%', :search, '%')) and b.createdAt >="
                + " :start and b.createdAt < :end order by b.createdAt desc")
    Page<Bill> findForOutletModule(
            @Param("outletId") Long outletId,
            @Param("module") com.sanasboutique.backend.common.OutletModule module,
            @Param("search") String search,
            @Param("start") Instant start,
            @Param("end") Instant end,
            Pageable pageable);

    /** Bills of one outlet in one franchisor-created billing module, in [start, end), newest first. */
    @Query(
            "select b from Bill b where b.outlet.id = :outletId and b.billingModule.id = :moduleId and"
                + " lower(b.billNumber) like lower(concat('%', :search, '%')) and b.createdAt >= :start"
                + " and b.createdAt < :end order by b.createdAt desc")
    Page<Bill> findForOutletBillingModule(
            @Param("outletId") Long outletId,
            @Param("moduleId") Long moduleId,
            @Param("search") String search,
            @Param("start") Instant start,
            @Param("end") Instant end,
            Pageable pageable);

    List<Bill> findTop10ByOutletIdAndBillingModuleIdOrderByCreatedAtDesc(Long outletId, Long billingModuleId);

    /** Bills of every outlet in [start, end). */
    @Query(
            "select b from Bill b where lower(b.billNumber) like lower(concat('%', :search, '%'))"
                + " and b.createdAt >= :start and b.createdAt < :end order by b.createdAt desc")
    Page<Bill> findForAll(
            @Param("search") String search,
            @Param("start") Instant start,
            @Param("end") Instant end,
            Pageable pageable);

    @Query(
            "select coalesce(sum(b.total), 0) from Bill b where b.outlet.id = :outletId and"
                + " b.createdAt >= :start and b.createdAt < :end")
    BigDecimal sumForOutlet(
            @Param("outletId") Long outletId,
            @Param("start") Instant start,
            @Param("end") Instant end);

    @Query(
            "select coalesce(sum(b.total), 0) from Bill b where b.createdAt >= :start and"
                + " b.createdAt < :end")
    BigDecimal sumForAll(@Param("start") Instant start, @Param("end") Instant end);

    @Query(
            "select count(b) from Bill b where b.outlet.id = :outletId and b.createdAt >= :start"
                + " and b.createdAt < :end")
    long countForOutlet(
            @Param("outletId") Long outletId,
            @Param("start") Instant start,
            @Param("end") Instant end);

    @Query("select count(b) from Bill b where b.createdAt >= :start and b.createdAt < :end")
    long countForAll(@Param("start") Instant start, @Param("end") Instant end);

    /** Bills of one customer (matched by outlet + mobile, so older bills without customer_id are included). */
    @Query(
            "select b from Bill b where b.outlet.id = :outletId and b.customerMobile = :mobile and"
                + " lower(b.billNumber) like lower(concat('%', :search, '%')) order by b.createdAt"
                + " desc")
    Page<Bill> findForCustomer(
            @Param("outletId") Long outletId,
            @Param("mobile") String mobile,
            @Param("search") String search,
            Pageable pageable);

    @Query(
            "select b.customerMobile, count(b), coalesce(sum(b.total),0), max(b.createdAt) from"
                + " Bill b where b.outlet.id = :outletId and b.customerMobile in :mobiles group by"
                + " b.customerMobile")
    List<Object[]> statsForMobiles(
            @Param("outletId") Long outletId,
            @Param("mobiles") java.util.Collection<String> mobiles);

    /** A customer's shop-sales bills since start, newest first (fabric bought for a stitching order). */
    @Query(
            "select b from Bill b where b.outlet.id = :outletId and b.customerMobile = :mobile and"
                + " b.module = com.sanasboutique.backend.common.OutletModule.SALES and b.billType ="
                + " com.sanasboutique.backend.outlet.entity.BillType.BILL and b.createdAt >= :start"
                + " order by b.createdAt desc")
    List<Bill> salesBillsSince(
            @Param("outletId") Long outletId,
            @Param("mobile") String mobile,
            @Param("start") Instant start);

    java.util.Optional<Bill> findByIdAndOutletId(Long id, Long outletId);

    /** Outlet ranking by sales in [start, end), best first. Rows: outletId, name, sales, bills. */
    @Query(
            "select o.id, o.name, sum(b.total), count(b) from Bill b join b.outlet o where"
                + " b.createdAt >= :start and b.createdAt < :end group by o.id, o.name order by"
                + " sum(b.total) desc")
    List<Object[]> outletRanking(@Param("start") Instant start, @Param("end") Instant end);
}
