package com.sanasboutique.backend.outlet.controller;

import com.sanasboutique.backend.outlet.dto.request.*;
import com.sanasboutique.backend.outlet.dto.response.*;
import com.sanasboutique.backend.common.OutletModule;
import com.sanasboutique.backend.outlet.service.ModuleAccess;
import com.sanasboutique.backend.outlet.service.LogActor;
import com.sanasboutique.backend.outlet.service.LogActors;
import com.sanasboutique.backend.outlet.service.ParlourService;
import com.sanasboutique.backend.security.AuthenticatedUser;

import jakarta.validation.Valid;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/** Parlour module of the signed-in outlet (docs/features/parlour.md). The outlet always comes from the JWT. */
@RestController
@RequestMapping("/api/outlet/me/parlour")
@PreAuthorize("hasRole('OUTLET')")
public class ParlourController {
    private final ParlourService service;
    private final ModuleAccess access;
    private final LogActors actors;

    public ParlourController(ParlourService service, ModuleAccess access, LogActors actors) {
        this.service = service;
        this.access = access;
        this.actors = actors;
    }

    @GetMapping("/services")
    public List<ParlourServiceGroup> services(@AuthenticationPrincipal AuthenticatedUser user) {
        return service.services(outlet(user));
    }

    /** Walk-in bill, or the bill of today's booked customer (bookingId). */
    @PostMapping("/bills")
    public BillResponse bill(
            @AuthenticationPrincipal AuthenticatedUser user, @Valid @RequestBody ParlourBillRequest request) {
        return service.bill(outlet(user), request, actor(user, request.authorName()));
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

    @PostMapping("/appointments")
    public ParlourAppointmentResponse book(
            @AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody ParlourAppointmentRequest request) {
        return service.book(outlet(user), request, actor(user, request.authorName()));
    }

    @GetMapping("/appointments/day")
    public List<ParlourAppointmentResponse> day(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return service.day(outlet(user), date);
    }

    /** status: BOOKED, DONE, CANCELLED, NOT_DONE; anything else = all. */
    @GetMapping("/appointments")
    public ParlourAppointmentPage search(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam(defaultValue = "ALL") String status,
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "0") int page) {
        return service.search(outlet(user), status, search, page);
    }

    @GetMapping("/appointments/lookup")
    public ParlourAppointmentResponse lookup(
            @AuthenticationPrincipal AuthenticatedUser user, @RequestParam String code) {
        return service.lookup(outlet(user), code);
    }

    @GetMapping("/appointments/{id}")
    public ParlourAppointmentResponse get(
            @AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long id) {
        return service.get(outlet(user), id);
    }

    @PostMapping("/appointments/{id}/cancel")
    public ParlourAppointmentResponse cancel(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable Long id,
            @Valid @RequestBody ParlourCancelRequest request) {
        return service.cancel(outlet(user), id, request, actor(user, request.authorName()));
    }

    /** Returns the new booking. */
    @PostMapping("/appointments/{id}/cancel-and-reschedule")
    public ParlourAppointmentResponse cancelAndReschedule(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable Long id,
            @Valid @RequestBody ParlourRescheduleRequest request) {
        return service.cancelAndReschedule(outlet(user), id, request, actor(user, request.authorName()));
    }

    @GetMapping("/appointments/{id}/log")
    public List<BookingLogResponse> log(
            @AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long id) {
        return service.log(outlet(user), id);
    }

    @PostMapping("/appointments/{id}/comments")
    public List<BookingLogResponse> comment(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable Long id,
            @Valid @RequestBody CommentRequest request) {
        return service.comment(outlet(user), id, request, actor(user, request.authorName()));
    }

    /** The caller's outlet; 403 when the franchisor has not given it the PARLOUR module (checked centrally). */
    private Long outlet(AuthenticatedUser user) {
        return access.outletFor(user, OutletModule.PARLOUR);
    }

    private LogActor actor(AuthenticatedUser user, String typedName) {
        return actors.of(user == null ? null : user.username(), typedName);
    }
}
