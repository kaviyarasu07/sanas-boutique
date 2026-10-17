package com.sanasboutique.backend.auth;

/** otp is only filled while app.otp.expose-in-response is true (no SMS provider yet). */
public record OtpResponse(String message, String otp, int validForMinutes) {}
