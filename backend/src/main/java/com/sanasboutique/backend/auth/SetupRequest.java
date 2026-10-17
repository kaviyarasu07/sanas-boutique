package com.sanasboutique.backend.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record SetupRequest(
        @NotBlank(message = "Full name is required") String fullName,
        @NotBlank(message = "Username is required")
                @Size(min = 3, max = 50, message = "Username must be 3-50 characters")
                String username,
        @NotBlank(message = "Mobile number is required")
                @Pattern(regexp = "^[0-9]{10}$", message = "Enter a 10-digit mobile number")
                String mobileNo,
        @NotBlank(message = "Password is required")
                @Size(min = 8, message = "Password must be at least 8 characters")
                String password) {}
