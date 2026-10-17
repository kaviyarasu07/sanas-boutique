package com.sanasboutique.backend.outlet.dto.response;

public record OutletCreatedResponse(
        Long id,
        String name,
        String ownerName,
        String address,
        String mobileNumber,
        String email,
        boolean active,
        String generatedPassword) {}
