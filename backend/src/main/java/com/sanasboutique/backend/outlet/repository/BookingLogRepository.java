package com.sanasboutique.backend.outlet.repository;

import com.sanasboutique.backend.outlet.entity.BookingLog;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/** Append-only: only save and read are used; rows are never updated or deleted. */
public interface BookingLogRepository extends JpaRepository<BookingLog, Long> {
    List<BookingLog> findByBookingIdOrderByIdAsc(Long bookingId);
}
