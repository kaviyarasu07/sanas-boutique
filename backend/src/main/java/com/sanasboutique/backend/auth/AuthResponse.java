package com.sanasboutique.backend.auth;

public record AuthResponse(
        String accessToken,
        String username,
        String fullName,
        String role,
        boolean mustChangePassword) {}
