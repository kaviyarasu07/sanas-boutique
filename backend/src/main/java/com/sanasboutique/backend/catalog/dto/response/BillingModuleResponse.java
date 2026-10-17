package com.sanasboutique.backend.catalog.dto.response;

/** code: used in bill numbers (PREFIX-code-000123). serviceCount: services billed in this module. */
public record BillingModuleResponse(Long id, String name, String code, String icon, boolean active, long serviceCount) {}
