package com.sanasboutique.backend.outlet.service;

import com.sanasboutique.backend.catalog.exception.DuplicateResourceException;
import com.sanasboutique.backend.catalog.exception.ResourceNotFoundException;
import com.sanasboutique.backend.outlet.dto.request.OutletRequest;
import com.sanasboutique.backend.outlet.dto.response.*;
import com.sanasboutique.backend.outlet.entity.*;
import com.sanasboutique.backend.outlet.mapper.OutletMapper;
import com.sanasboutique.backend.outlet.repository.*;
import com.sanasboutique.backend.user.*;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class OutletServiceImpl implements OutletService {
    private final OutletRepository outlets;
    private final FranchiseRepository franchises;
    private final AppUserRepository users;
    private final PasswordEncoder encoder;
    private final OutletMapper mapper;
    private final OutletServiceRepository outletServices;
    private final com.sanasboutique.backend.catalog.repository.CatalogServiceRepository catalog;

    public OutletServiceImpl(
            OutletRepository outlets,
            FranchiseRepository franchises,
            AppUserRepository users,
            PasswordEncoder encoder,
            OutletMapper mapper,
            OutletServiceRepository outletServices,
            com.sanasboutique.backend.catalog.repository.CatalogServiceRepository catalog) {
        this.outletServices = outletServices;
        this.catalog = catalog;
        this.outlets = outlets;
        this.franchises = franchises;
        this.users = users;
        this.encoder = encoder;
        this.mapper = mapper;
    }

    public OutletCreatedResponse create(OutletRequest r) {
        String mobile = clean(r.mobileNumber()), email = clean(r.email()).toLowerCase();
        ensureUnique(mobile, email, null);
        List<com.sanasboutique.backend.catalog.entity.CatalogService> chosen =
                chosenServices(r.serviceIds());
        String password = password(r.ownerName(), r.name(), mobile);
        // franchise.code is VARCHAR(30) in the existing schema; keep the generated code within that
        // limit.
        Franchise f =
                franchises.save(
                        new Franchise(
                                clean(r.name()),
                                "outlet-"
                                        + UUID.randomUUID()
                                                .toString()
                                                .replace("-", "")
                                                .substring(0, 22)));
        AppUser user =
                users.save(
                        new AppUser(
                                f.getId(),
                                email,
                                mobile,
                                encoder.encode(password),
                                clean(r.ownerName()),
                                Role.OUTLET));
        user.setSystemPassword(user.getPasswordHash());
        Outlet o =
                outlets.save(
                        new Outlet(
                                f.getId(),
                                clean(r.name()),
                                clean(r.ownerName()),
                                blank(r.address()),
                                mobile,
                                email,
                                user.getId()));
        for (var svc : chosen)
            outletServices.save(new com.sanasboutique.backend.outlet.entity.OutletService(o, svc));
        // TODO: deliver the one-time password through SMS, email, or WhatsApp.
        return mapper.toCreated(o, password);
    }

    @Transactional(readOnly = true)
    public List<OutletResponse> list() {
        return outlets.findAllByOrderByNameAsc().stream().map(mapper::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public OutletResponse get(Long id) {
        return mapper.toResponse(find(id));
    }

    public OutletResponse update(Long id, OutletRequest r) {
        Outlet o = find(id);
        String mobile = clean(r.mobileNumber()), email = clean(r.email()).toLowerCase();
        ensureUnique(mobile, email, id);
        o.setName(clean(r.name()));
        o.setOwnerName(clean(r.ownerName()));
        o.setAddress(blank(r.address()));
        o.setMobileNumber(mobile);
        o.setEmail(email);
        users.updateIdentity(
                o.getAppUserId(),
                users.findById(o.getAppUserId())
                        .orElseThrow(() -> new ResourceNotFoundException("Outlet login not found"))
                        .getUsername(),
                mobile,
                clean(r.ownerName()));
        return mapper.toResponse(outlets.save(o));
    }

    public OutletResponse setActive(Long id, boolean active) {
        Outlet o = find(id);
        o.setActive(active);
        users.updateActive(o.getAppUserId(), active);
        return mapper.toResponse(outlets.save(o));
    }

    public OutletCreatedResponse regeneratePassword(Long id) {
        Outlet o = find(id);
        String p = password(o.getOwnerName(), o.getName(), o.getMobileNumber());
        users.findById(o.getAppUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Outlet login not found"))
                .setSystemPassword(encoder.encode(p));
        return mapper.toCreated(o, p);
    }

    /** A new outlet must start with at least one active service; the admin picks them when creating it. */
    private List<com.sanasboutique.backend.catalog.entity.CatalogService> chosenServices(
            List<Long> ids) {
        if (ids == null || ids.isEmpty())
            throw new IllegalArgumentException("Choose at least one service for this outlet");
        List<com.sanasboutique.backend.catalog.entity.CatalogService> found =
                catalog.findAllById(new java.util.LinkedHashSet<>(ids));
        if (found.size() != new java.util.HashSet<>(ids).size()
                || found.stream().anyMatch(x -> !x.isActive()))
            throw new IllegalArgumentException("One or more selected services are not available");
        return found;
    }

    private Outlet find(Long id) {
        return outlets.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Outlet not found"));
    }

    private void ensureUnique(String mobile, String email, Long current) {
        for (Outlet o : outlets.findAll()) {
            if (current != null && o.getId().equals(current)) continue;
            if (o.getMobileNumber().equals(mobile))
                throw new DuplicateResourceException(
                        "An outlet with that mobile number already exists");
            if (o.getEmail().equalsIgnoreCase(email))
                throw new DuplicateResourceException("An outlet with that email already exists");
        }
        if (users.findByUsernameIgnoreCase(email).isPresent()
                && (current == null
                        || !users.findByUsernameIgnoreCase(email)
                                .get()
                                .getId()
                                .equals(find(current).getAppUserId())))
            throw new DuplicateResourceException("That email is already registered");
    }

    private static String clean(String s) {
        return s.trim();
    }

    private static String blank(String s) {
        return s == null || s.trim().isEmpty() ? null : s.trim();
    }

    /** 8 chars: first 3 letters/digits of the owner name + first 3 of the outlet name + last 2 digits of the mobile (lower case, padded with 'x'). */
    static String password(String ownerName, String outletName, String mobile) {
        return part(ownerName, 3)
                + part(outletName, 3)
                + mobile.substring(Math.max(0, mobile.length() - 2));
    }

    private static String part(String s, int n) {
        String a = s.toLowerCase().replaceAll("[^\\p{L}\\p{N}]", "");
        return a.length() >= n ? a.substring(0, n) : a + "x".repeat(n - a.length());
    }
}
