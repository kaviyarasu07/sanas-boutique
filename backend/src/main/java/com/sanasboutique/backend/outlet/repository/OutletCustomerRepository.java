package com.sanasboutique.backend.outlet.repository;

import com.sanasboutique.backend.outlet.entity.OutletCustomer;

import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.*;

public interface OutletCustomerRepository extends JpaRepository<OutletCustomer, Long> {
    Optional<OutletCustomer> findByOutletIdAndMobileNumber(Long outletId, String mobile);

    List<OutletCustomer> findTop10ByOutletIdAndMobileNumberContainingOrderByNameAsc(
            Long outletId, String mobile);

    /** Customers of one outlet matching name or mobile. */
    @Query(
            "select c from OutletCustomer c where c.outlet.id = :outletId and (lower(c.name) like"
                + " lower(concat('%', :search, '%')) or c.mobileNumber like concat('%', :search,"
                + " '%')) order by c.name asc")
    Page<OutletCustomer> search(
            @Param("outletId") Long outletId, @Param("search") String search, Pageable pageable);

    Optional<OutletCustomer> findByIdAndOutletId(Long id, Long outletId);
}
