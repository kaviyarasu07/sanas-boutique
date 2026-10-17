package com.sanasboutique.backend.auth;

import com.sanasboutique.backend.user.AppUser;
import com.sanasboutique.backend.user.AppUserRepository;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.Instant;

/**
 * Password lifecycle: forced change after a system-generated password, and
 * OTP-based reset. The OTP flow is only open to users who have already chosen
 * their own password once; anyone still on the system-generated password asks
 * the admin for a new one instead.
 */
@Service
@Transactional
public class PasswordService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final AppUserRepository users;
    private final PasswordEncoder encoder;
    private final boolean exposeOtp;
    private final long otpTtlMinutes;
    private final int maxAttempts;

    public PasswordService(
            AppUserRepository users,
            PasswordEncoder encoder,
            @Value("${app.otp.expose-in-response}") boolean exposeOtp,
            @Value("${app.otp.ttl-minutes}") long otpTtlMinutes,
            @Value("${app.otp.max-attempts}") int maxAttempts) {
        this.users = users;
        this.encoder = encoder;
        this.exposeOtp = exposeOtp;
        this.otpTtlMinutes = otpTtlMinutes;
        this.maxAttempts = maxAttempts;
    }

    /** Authenticated change (also the forced first-login change). */
    public AppUser change(String username, String currentPassword, String newPassword) {
        AppUser user =
                users.findByUsernameIgnoreCase(username)
                        .orElseThrow(
                                () ->
                                        new ResponseStatusException(
                                                HttpStatus.UNAUTHORIZED, "Please sign in again"));
        if (!encoder.matches(currentPassword, user.getPasswordHash())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Current password is incorrect");
        }
        if (encoder.matches(newPassword, user.getPasswordHash())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Choose a password different from the current one");
        }
        user.setUserPassword(encoder.encode(newPassword));
        return user;
    }

    @Transactional(readOnly = true)
    public AppUser current(String username) {
        return users.findByUsernameIgnoreCase(username)
                .orElseThrow(
                        () ->
                                new ResponseStatusException(
                                        HttpStatus.UNAUTHORIZED, "Please sign in again"));
    }

    public OtpResponse requestOtp(String mobileNo) {
        AppUser user =
                users.findByMobileNo(mobileNo)
                        .orElseThrow(
                                () ->
                                        new ResponseStatusException(
                                                HttpStatus.NOT_FOUND,
                                                "No account found for that mobile number"));
        if (!user.isActive()) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN, "This account has been deactivated");
        }
        if (user.getPasswordChangedAt() == null) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Password reset by OTP is not available yet. Sign in with the password you were"
                        + " given, or ask the admin to issue a new one");
        }
        String otp = String.format("%06d", RANDOM.nextInt(1_000_000));
        user.setResetOtp(encoder.encode(otp), Instant.now().plusSeconds(otpTtlMinutes * 60));
        // TODO: send the OTP by SMS/WhatsApp and set app.otp.expose-in-response=false.
        return new OtpResponse("OTP generated", exposeOtp ? otp : null, (int) otpTtlMinutes);
    }

    // A wrong OTP must still count as an attempt, so the exception must not roll the counter back.
    @Transactional(noRollbackFor = ResponseStatusException.class)
    public void reset(String mobileNo, String otp, String newPassword) {
        AppUser user =
                users.findByMobileNo(mobileNo)
                        .orElseThrow(
                                () ->
                                        new ResponseStatusException(
                                                HttpStatus.BAD_REQUEST, "Invalid or expired OTP"));
        if (user.getResetOtpHash() == null
                || user.getResetOtpExpiresAt() == null
                || user.getResetOtpExpiresAt().isBefore(Instant.now())
                || user.getResetOtpAttempts() >= maxAttempts) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Invalid or expired OTP. Request a new one");
        }
        if (!encoder.matches(otp, user.getResetOtpHash())) {
            user.recordFailedOtp();
            users.saveAndFlush(user);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid or expired OTP");
        }
        user.setUserPassword(encoder.encode(newPassword));
    }
}
