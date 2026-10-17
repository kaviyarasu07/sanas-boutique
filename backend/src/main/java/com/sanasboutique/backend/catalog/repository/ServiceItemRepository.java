package com.sanasboutique.backend.catalog.repository;

import com.sanasboutique.backend.catalog.entity.ServiceItem;

import jakarta.persistence.LockModeType;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ServiceItemRepository extends JpaRepository<ServiceItem, Long> {

    List<ServiceItem> findByServiceIdOrderByNameAsc(Long serviceId);

    long countByServiceId(Long serviceId);

    @Query(
            "select i from ServiceItem i where i.service.id = :serviceId and "
                    + "(:search = '' or lower(i.name) like lower(concat('%', :search, '%')) "
                    + "or lower(i.itemCode) like lower(concat('%', :search, '%')) "
                    + "or str(i.id) like concat('%', :search, '%')) order by i.name asc")
    Page<ServiceItem> searchByServiceId(
            @Param("serviceId") Long serviceId, @Param("search") String search, Pageable pageable);

    /** Row-locked read used while billing so concurrent bills cannot oversell stock. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from ServiceItem i where i.id = :id")
    Optional<ServiceItem> findByIdForUpdate(@Param("id") Long id);

    long countByOutletIdAndServiceId(Long outletId, Long serviceId);

    Optional<ServiceItem> findByIdAndOutletId(Long id, Long outletId);

    /** Active items of one outlet whose service belongs to the module (e.g. the parlour service grid), by service then name. */
    @Query(
            "select i from ServiceItem i join fetch i.service s where i.outletId = :outletId and"
                + " s.module = :module and i.active = true order by s.name, i.name")
    List<ServiceItem> findActiveForOutletModule(
            @Param("outletId") Long outletId,
            @Param("module") com.sanasboutique.backend.common.OutletModule module);

    List<ServiceItem> findByOutletIdAndServiceIdOrderByNameAsc(Long outletId, Long serviceId);

    @Query(
            "select i from ServiceItem i where i.outletId = :outletId and i.service.id = :serviceId"
                + " and (:search = '' or lower(i.name) like lower(concat('%', :search, '%')) or"
                + " lower(i.itemCode) like lower(concat('%', :search, '%'))) order by i.name asc")
    Page<ServiceItem> searchForOutletService(
            @Param("outletId") Long outletId,
            @Param("serviceId") Long serviceId,
            @Param("search") String search,
            Pageable pageable);

    Optional<ServiceItem> findByItemCode(String itemCode);

    /** Scoped lookup for scanning: a code from another outlet is simply not found. */
    Optional<ServiceItem> findByItemCodeIgnoreCaseAndOutletId(String itemCode, Long outletId);

    boolean existsByItemCodeIgnoreCase(String itemCode);
}
