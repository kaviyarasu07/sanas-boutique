package com.sanasboutique.backend.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record ForgotPasswordRequest(
        @NotBlank(message = "Mobile number is required")
                @Pattern(
                        regexp = "^[0-9]{7,15}$",
                        message = "Enter your mobile number (digits only)")
                String mobileNo) {}
