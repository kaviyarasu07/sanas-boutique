package com.sanasboutique.backend.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ResetPasswordRequest(
        @NotBlank(message = "Mobile number is required")
                @Pattern(
                        regexp = "^[0-9]{7,15}$",
                        message = "Enter your mobile number (digits only)")
                String mobileNo,
        @NotBlank(message = "OTP is required")
                @Pattern(regexp = "^[0-9]{6}$", message = "Enter the 6-digit OTP")
                String otp,
        @NotBlank(message = "New password is required")
                @Size(min = 8, max = 72, message = "New password must be 8-72 characters")
                String newPassword) {}
