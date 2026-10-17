package com.sanasboutique.backend.outlet.dto.request;

import jakarta.validation.constraints.*;

import java.util.List;

/** serviceIds: the services the admin enables for the outlet at creation (required then; ignored on edit - use the service toggles). */
public record OutletRequest(
        @NotBlank String name,
        @NotBlank String ownerName,
        String address,
        @NotBlank
                @Pattern(
                        regexp = "^[0-9]{10}$",
                        message = "Mobile number must be exactly 10 digits")
                String mobileNumber,
        @NotBlank
                @Email
                @Pattern(
                        regexp = "^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$",
                        message = "Enter a valid email address, like name@example.com")
                @Size(max = 254)
                String email,
        List<Long> serviceIds) {}
