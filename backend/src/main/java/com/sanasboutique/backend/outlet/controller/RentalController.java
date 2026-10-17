package com.sanasboutique.backend.outlet.controller;

import com.sanasboutique.backend.outlet.dto.request.*;
import com.sanasboutique.backend.outlet.dto.response.*;
import com.sanasboutique.backend.common.OutletModule;
import com.sanasboutique.backend.outlet.service.ModuleAccess;
import com.sanasboutique.backend.outlet.service.LogActor;
import com.sanasboutique.backend.outlet.service.LogActors;
import com.sanasboutique.backend.outlet.service.RentalService;
import com.sanasboutique.backend.security.AuthenticatedUser;

import jakarta.validation.Valid;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/** Jewellery rental module of the signed-in outlet (docs/features/jewellery-rental-flow.md). The outlet always comes from the JWT. */
@RestController
@RequestMapping("/api/outlet/me/rental")
@PreAuthorize("hasRole('OUTLET')")
public class RentalController {
    private final RentalService service;
    private final ModuleAccess access;
    private final LogActors actors;

    public RentalController(RentalService service, ModuleAccess access, LogActors actors) {
        this.service = service;
        this.access = access;
        this.actors = actors;
    }

    @GetMapping("/products")
    public List<RentalProductResponse> products(
            @AuthenticationPrincipal AuthenticatedUser user, @RequestParam(defaultValue = "") String search) {
        return service.products(outlet(user), search);
    }

    @GetMapping("/availability")
    public AvailabilityResponse availability(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam Long itemId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "1") int quantity) {
        return service.availability(outlet(user), itemId, from, to, quantity);
    }

    @GetMapping("/dashboard")
    public RentalDashboardResponse dashboard(@AuthenticationPrincipal AuthenticatedUser user) {
        return service.dashboard(outlet(user));
    }

    @PostMapping("/bookings")
    public RentalBookingResponse book(
            @AuthenticationPrincipal AuthenticatedUser user, @Valid @RequestBody RentalBookRequest request) {
        return service.book(outlet(user), request, actor(user, request.authorName()));
    }

    /** Book for today and hand over at once (walk-in rental); returns the booking with its challan. */
    @PostMapping("/bookings/rent-now")
    public RentalBookingResponse rentNow(
            @AuthenticationPrincipal AuthenticatedUser user, @Valid @RequestBody RentalBookRequest request) {
        return service.rentNow(outlet(user), request, actor(user, request.authorName()));
    }

    @GetMapping("/bookings/day")
    public List<RentalBookingResponse> day(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return service.day(outlet(user), date);
    }

    /** status: BOOKED, WITH_CUSTOMER, RETURNED, CANCELLED, NOT_COLLECTED; anything else = all. */
    @GetMapping("/bookings")
    public RentalBookingPage search(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam(defaultValue = "ALL") String status,
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "0") int page) {
        return service.search(outlet(user), status, search, page);
    }

    /** Booking number (slip) or challan number. */
    @GetMapping("/bookings/lookup")
    public RentalBookingResponse lookup(@AuthenticationPrincipal AuthenticatedUser user, @RequestParam String code) {
        return service.lookup(outlet(user), code);
    }

    @GetMapping("/bookings/{id}")
    public RentalBookingResponse get(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long id) {
        return service.get(outlet(user), id);
    }

    @PostMapping("/bookings/{id}/hand-over")
    public RentalBookingResponse handOver(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable Long id,
            @Valid @RequestBody RentalHandOverRequest request) {
        return service.handOver(outlet(user), id, request, actor(user, request.authorName()));
    }

    @PostMapping("/bookings/{id}/return")
    public RentalBookingResponse returnRental(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable Long id,
            @Valid @RequestBody RentalReturnRequest request) {
        return service.returnRental(outlet(user), id, request, actor(user, request.authorName()));
    }

    @PostMapping("/bookings/{id}/cancel")
    public RentalBookingResponse cancel(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable Long id,
            @Valid @RequestBody ParlourCancelRequest request) {
        return service.cancel(outlet(user), id, request, actor(user, request.authorName()));
    }

    /** Returns the new booking. */
    @PostMapping("/bookings/{id}/cancel-and-reschedule")
    public RentalBookingResponse cancelAndReschedule(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable Long id,
            @Valid @RequestBody RentalRescheduleRequest request) {
        return service.cancelAndReschedule(outlet(user), id, request, actor(user, request.authorName()));
    }

    @GetMapping("/bookings/{id}/log")
    public List<BookingLogResponse> log(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long id) {
        return service.log(outlet(user), id);
    }

    @PostMapping("/bookings/{id}/comments")
    public List<BookingLogResponse> comment(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable Long id,
            @Valid @RequestBody CommentRequest request) {
        return service.comment(outlet(user), id, request, actor(user, request.authorName()));
    }

    @GetMapping("/repairs")
    public List<RepairResponse> repairs(@AuthenticationPrincipal AuthenticatedUser user) {
        return service.repairs(outlet(user));
    }

    @PostMapping("/repairs/{id}/back-in-stock")
    public RepairResponse backInStock(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable Long id,
            @Valid @RequestBody(required = false) AuthorRequest request) {
        return service.backInStock(outlet(user), id, actor(user, request == null ? null : request.authorName()));
    }

    @GetMapping("/bills")
    public BillPageResponse bills(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {
        return service.bills(outlet(user), search, page, from, to);
    }

    /** The caller's outlet; 403 when the franchisor has not given it the RENTAL module (checked centrally). */
    private Long outlet(AuthenticatedUser user) {
        return access.outletFor(user, OutletModule.RENTAL);
    }

    private LogActor actor(AuthenticatedUser user, String typedName) {
        return actors.of(user == null ? null : user.username(), typedName);
    }
}
