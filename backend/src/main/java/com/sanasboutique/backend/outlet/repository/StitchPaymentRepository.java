package com.sanasboutique.backend.outlet.repository;

import com.sanasboutique.backend.outlet.entity.StitchPayment;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StitchPaymentRepository extends JpaRepository<StitchPayment, Long> {
    List<StitchPayment> findByOrderIdOrderByIdAsc(Long orderId);
}
