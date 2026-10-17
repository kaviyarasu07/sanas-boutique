package com.sanasboutique.backend.outlet.controller;

import com.sanasboutique.backend.outlet.dto.response.BookingResponse;
import com.sanasboutique.backend.outlet.service.BookingService;
import com.sanasboutique.backend.outlet.service.ModuleAccess;
import com.sanasboutique.backend.security.AuthenticatedUser;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/**
 * Read-only schedule for the Overview dashboard (appointments and rentals of a day; overdue rentals).
 * The old shared Bookings module (create, hand over, return, complete, cancel) was removed
 * (owner decision 2026-10-11): bookings are made in the Jewellery rental and Parlour modules.
 */
@RestController
@RequestMapping("/api/outlet/me/bookings")
@PreAuthorize("hasRole('OUTLET')")
public class BookingController {
    private final BookingService service;
    private final ModuleAccess access;

    public BookingController(BookingService s, ModuleAccess a) {
        service = s;
        access = a;
    }

    /** Everything on one day: parlour appointments, rental take-aways and returns. */
    @GetMapping("/day")
    public List<BookingResponse> day(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return service.day(access.outletOf(user), date);
    }

    /** Rentals past their return date and not yet returned. */
    @GetMapping("/overdue")
    public List<BookingResponse> overdue(@AuthenticationPrincipal AuthenticatedUser user) {
        return service.overdue(access.outletOf(user));
    }
}
