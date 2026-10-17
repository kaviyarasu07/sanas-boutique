package com.sanasboutique.backend.catalog.service;

import com.sanasboutique.backend.catalog.dto.request.BillingModuleRequest;
import com.sanasboutique.backend.catalog.dto.response.BillingModuleResponse;
import com.sanasboutique.backend.catalog.entity.BillingModule;
import com.sanasboutique.backend.catalog.exception.DuplicateResourceException;
import com.sanasboutique.backend.catalog.exception.ResourceNotFoundException;
import com.sanasboutique.backend.catalog.repository.BillingModuleRepository;
import com.sanasboutique.backend.catalog.repository.CatalogServiceRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * Franchisor-created simple billing modules (docs/features/custom-billing-modules.md). The bill code
 * is generated from the name ("Bangle sales" → BS, then BS2, BS3… if taken) and never collides with
 * the codes the app already uses in bill and document numbers.
 */
@Service
@Transactional
public class BillingModuleService {
    /** Codes already used in numbers: rental, parlour, stitching, delivery challan, refund, booking (and the plain sales/item prefixes). */
    static final Set<String> RESERVED = Set.of("R", "P", "ST", "DC", "RF", "BK", "SB", "OUT");

    private final BillingModuleRepository modules;
    private final CatalogServiceRepository services;

    public BillingModuleService(BillingModuleRepository modules, CatalogServiceRepository services) {
        this.modules = modules;
        this.services = services;
    }

    @Transactional(readOnly = true)
    public List<BillingModuleResponse> list() {
        return modules.findAllByOrderByNameAsc().stream().map(this::response).toList();
    }

    /** The code a new module with this name would get (shown before saving). */
    @Transactional(readOnly = true)
    public String previewCode(String name) {
        return generateCode(name == null ? "" : name);
    }

    public BillingModuleResponse create(BillingModuleRequest r) {
        String name = r.name().trim();
        if (modules.existsByNameIgnoreCase(name)) throw new DuplicateResourceException("A billing module named \"" + name + "\" already exists");
        return response(modules.save(new BillingModule(name, generateCode(name), r.icon())));
    }

    /** Name and icon can change; the code stays (bills already carry it). */
    public BillingModuleResponse update(Long id, BillingModuleRequest r) {
        BillingModule m = find(id);
        String name = r.name().trim();
        if (!name.equalsIgnoreCase(m.getName()) && modules.existsByNameIgnoreCase(name))
            throw new DuplicateResourceException("A billing module named \"" + name + "\" already exists");
        m.setName(name);
        m.setIcon(r.icon());
        return response(m);
    }

    /** Switched off: hidden at every outlet and refused by the API; bills stay. */
    public BillingModuleResponse setActive(Long id, boolean active) {
        BillingModule m = find(id);
        m.setActive(active);
        return response(m);
    }

    @Transactional(readOnly = true)
    public BillingModule find(Long id) {
        return modules.findById(id).orElseThrow(() -> new ResourceNotFoundException("Billing module not found"));
    }

    /** Initials of the first words (one word: its first two letters), then a number if taken or reserved. */
    String generateCode(String name) {
        String[] words = name.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9 ]", " ").trim().split("\\s+");
        StringBuilder base = new StringBuilder();
        if (words.length >= 2) for (int i = 0; i < Math.min(3, words.length); i++) base.append(words[i].charAt(0));
        else if (!words[0].isEmpty()) base.append(words[0], 0, Math.min(2, words[0].length()));
        if (base.isEmpty() || !Character.isLetter(base.charAt(0))) base.insert(0, 'M');
        String b = base.substring(0, Math.min(3, base.length()));
        String code = b;
        for (int n = 2; RESERVED.contains(code) || modules.existsByCode(code); n++) code = b + n;
        return code;
    }

    private BillingModuleResponse response(BillingModule m) {
        return new BillingModuleResponse(m.getId(), m.getName(), m.getCode(), m.getIcon(), m.isActive(), services.countByBillingModuleId(m.getId()));
    }
}
