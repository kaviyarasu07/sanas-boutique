package com.sanasboutique.backend.security;

/**
 * The JWT's claims, decoded. This is what controllers get back from
 * SecurityContextHolder - never trust a franchiseId from anywhere else
 * (request body, query param) for a tenant-scoped query.
 */
public record AuthenticatedUser(String username, String role, Long franchiseId) {}
