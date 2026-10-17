package com.sanasboutique.backend.outlet.dto.request;

import jakarta.validation.constraints.*;

/** What an outlet may change about itself. Outlet name and mobile number are fixed. */
public record OutletProfileRequest(
        @NotBlank String ownerName,
        @Size(max = 500) String address,
        @NotBlank
                @Email
                @Pattern(
                        regexp = "^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$",
                        message = "Enter a valid email address, like name@example.com")
                @Size(max = 254)
                String email) {}
