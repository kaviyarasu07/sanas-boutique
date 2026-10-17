package com.sanasboutique.backend.outlet.controller;

import com.sanasboutique.backend.outlet.dto.request.*;
import com.sanasboutique.backend.outlet.dto.response.*;
import com.sanasboutique.backend.common.OutletModule;
import com.sanasboutique.backend.outlet.service.ModuleAccess;
import com.sanasboutique.backend.outlet.service.StitchService;
import com.sanasboutique.backend.outlet.service.LogActor;
import com.sanasboutique.backend.security.AuthenticatedUser;

import jakarta.validation.Valid;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/**
 * Stitching orders of the signed-in outlet (docs/features/stitching-orders.md). The outlet always
 * comes from the JWT, never from the request; the log author is the signed-in user (or the optional
 * "Your name" typed on the screen).
 */
@RestController
@RequestMapping("/api/outlet/me/stitching")
@PreAuthorize("hasRole('OUTLET')")
public class StitchController {
    private final StitchService service;
    private final ModuleAccess access;

    public StitchController(StitchService s, ModuleAccess a) {
        service = s;
        access = a;
    }

    @PostMapping
    public StitchOrderResponse create(
            @AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody StitchOrderRequest request) {
        return service.create(outlet(user), request, actor(user, request.authorName()));
    }

    /** view: OPEN, READY (has a finished garment), DELIVERED, CANCELLED; anything else lists all. search matches order number, customer name or mobile. */
    @GetMapping
    public StitchPageResponse list(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam(defaultValue = "OPEN") String view,
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "0") int page) {
        return service.list(outlet(user), view, search, page);
    }

    /** Exact receipt number, e.g. from scanning the receipt barcode. */
    @GetMapping("/lookup")
    public StitchOrderResponse lookup(
            @AuthenticationPrincipal AuthenticatedUser user, @RequestParam String code) {
        return service.lookup(outlet(user), code);
    }

    /** Orders with a garment due that day and not yet delivered. */
    @GetMapping("/due")
    public List<StitchOrderResponse> due(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return service.due(outlet(user), date);
    }

    /** Calendar: orders with any garment dated that day. */
    @GetMapping("/day")
    public List<StitchOrderResponse> day(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return service.day(outlet(user), date);
    }

    @GetMapping("/overdue")
    public List<StitchOrderResponse> overdue(@AuthenticationPrincipal AuthenticatedUser user) {
        return service.overdue(outlet(user));
    }

    @GetMapping("/upcoming")
    public List<StitchOrderResponse> upcoming(@AuthenticationPrincipal AuthenticatedUser user) {
        return service.upcoming(outlet(user));
    }

    /** The customer's earlier measurements at this outlet ("Use previous measurements"). */
    @GetMapping("/measurements")
    public List<StitchMeasurementResponse> measurements(
            @AuthenticationPrincipal AuthenticatedUser user, @RequestParam String mobile) {
        return service.measurements(outlet(user), mobile);
    }

    /** Today's shop bills of the customer ("Fabric bought here today"). */
    @GetMapping("/fabric-bills")
    public List<StitchFabricBillResponse> fabricBills(
            @AuthenticationPrincipal AuthenticatedUser user, @RequestParam String mobile) {
        return service.fabricBills(outlet(user), mobile);
    }

    @GetMapping("/{id}")
    public StitchOrderResponse get(
            @AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long id) {
        return service.get(outlet(user), id);
    }

    @PutMapping("/{id}")
    public StitchOrderResponse updateOrder(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable Long id,
            @Valid @RequestBody StitchOrderUpdateRequest request) {
        return service.updateOrder(outlet(user), id, request, actor(user, request.authorName()));
    }

    @PostMapping("/{id}/items")
    public StitchOrderResponse addItem(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable Long id,
            @Valid @RequestBody StitchItemRequest request) {
        return service.addItem(outlet(user), id, request, actor(user, request.authorName()));
    }

    @PutMapping("/{id}/items/{itemId}")
    public StitchOrderResponse updateItem(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable Long id,
            @PathVariable Long itemId,
            @Valid @RequestBody StitchItemRequest request) {
        return service.updateItem(
                outlet(user), id, itemId, request, actor(user, request.authorName()));
    }

    @PostMapping("/{id}/items/{itemId}/status")
    public StitchOrderResponse setItemStatus(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable Long id,
            @PathVariable Long itemId,
            @Valid @RequestBody StitchStatusRequest request) {
        return service.setItemStatus(
                outlet(user), id, itemId, request, actor(user, request.authorName()));
    }

    @PostMapping("/{id}/advances")
    public StitchOrderResponse addAdvance(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable Long id,
            @Valid @RequestBody StitchAdvanceRequest request) {
        return service.addAdvance(outlet(user), id, request, actor(user, request.authorName()));
    }

    @PostMapping("/{id}/deliver")
    public StitchOrderResponse deliver(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable Long id,
            @Valid @RequestBody StitchDeliverRequest request) {
        return service.deliver(outlet(user), id, request, actor(user, request.authorName()));
    }

    @PostMapping("/{id}/cancel")
    public StitchOrderResponse cancel(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable Long id,
            @Valid @RequestBody StitchCancelRequest request) {
        return service.cancel(outlet(user), id, request, actor(user, request.authorName()));
    }

    @PostMapping("/{id}/refunds")
    public StitchOrderResponse refund(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable Long id,
            @Valid @RequestBody StitchRefundRequest request) {
        return service.refund(outlet(user), id, request, actor(user, request.authorName()));
    }

    @GetMapping("/{id}/log")
    public List<StitchLogResponse> log(
            @AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long id) {
        return service.log(outlet(user), id);
    }

    @PostMapping("/{id}/comments")
    public List<StitchLogResponse> comment(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable Long id,
            @Valid @RequestBody StitchCommentRequest request) {
        return service.comment(outlet(user), id, request, actor(user, request.authorName()));
    }

    /** The caller's outlet; 403 when the franchisor has not given it the STITCHING module (checked centrally). */
    private Long outlet(AuthenticatedUser user) {
        return access.outletFor(user, OutletModule.STITCHING);
    }

    private LogActor actor(AuthenticatedUser user, String typedName) {
        return service.actor(user == null ? null : user.username(), typedName);
    }
}
