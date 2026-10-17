package com.sanasboutique.backend.auth;

import com.sanasboutique.backend.security.AuthenticatedUser;
import com.sanasboutique.backend.security.JwtService;
import com.sanasboutique.backend.user.AppUser;
import com.sanasboutique.backend.user.AppUserRepository;
import com.sanasboutique.backend.user.Role;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * There is no public sign-up. /setup creates exactly one FRANCHISOR account
 * and only works while none exists yet - after that it always 409s. Every
 * other account (franchise owner, staff) gets created by an admin from
 * inside the app later, not through this controller.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AppUserRepository appUserRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final PasswordService passwordService;
    private final com.sanasboutique.backend.outlet.service.LeftoverBookings leftoverBookings;

    public AuthController(
            AppUserRepository appUserRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            PasswordService passwordService,
            com.sanasboutique.backend.outlet.service.LeftoverBookings leftoverBookings) {
        this.passwordService = passwordService;
        this.leftoverBookings = leftoverBookings;
        this.appUserRepository = appUserRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @GetMapping("/setup-status")
    public SetupStatusResponse setupStatus() {
        return new SetupStatusResponse(appUserRepository.existsByRole(Role.FRANCHISOR));
    }

    @PostMapping("/setup")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse setup(@Valid @RequestBody SetupRequest request) {
        if (appUserRepository.existsByRole(Role.FRANCHISOR)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "Setup has already been completed");
        }
        if (appUserRepository.findByUsernameIgnoreCase(request.username()).isPresent()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "That username is already taken");
        }
        if (appUserRepository.existsByMobileNo(request.mobileNo().trim())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "That mobile number is already registered");
        }

        AppUser admin =
                new AppUser(
                        null,
                        request.username().trim(),
                        request.mobileNo().trim(),
                        passwordEncoder.encode(request.password()),
                        request.fullName().trim(),
                        Role.FRANCHISOR);
        admin.setUserPassword(admin.getPasswordHash());
        appUserRepository.save(admin);

        return toAuthResponse(admin);
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        AppUser user =
                appUserRepository
                        .findByMobileNo(request.mobileNo().trim())
                        .orElseThrow(
                                () ->
                                        new ResponseStatusException(
                                                HttpStatus.UNAUTHORIZED,
                                                "Invalid mobile number or password"));

        if (!user.isActive()) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED, "This account has been deactivated");
        }
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED, "Invalid mobile number or password");
        }

        // Daily check at login (no scheduler): cancel this outlet's leftover bookings from earlier days.
        if (user.getRole() == Role.OUTLET) leftoverBookings.cancelAtLogin(user.getFranchiseId());

        return toAuthResponse(user);
    }

    @GetMapping("/me")
    public ProfileResponse me(Authentication authentication) {
        var principal = (AuthenticatedUser) authentication.getPrincipal();
        AppUser u = passwordService.current(principal.username());
        return new ProfileResponse(
                u.getFullName(), u.getMobileNo(), u.getUsername(), u.getRole().name());
    }

    @PostMapping("/change-password")
    public AuthResponse changePassword(
            @Valid @RequestBody ChangePasswordRequest request, Authentication authentication) {
        var principal = (AuthenticatedUser) authentication.getPrincipal();
        return toAuthResponse(
                passwordService.change(
                        principal.username(), request.currentPassword(), request.newPassword()));
    }

    @PostMapping("/forgot-password")
    public OtpResponse forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        return passwordService.requestOtp(request.mobileNo().trim());
    }

    @PostMapping("/reset-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        passwordService.reset(request.mobileNo().trim(), request.otp(), request.newPassword());
    }

    private AuthResponse toAuthResponse(AppUser user) {
        String token = jwtService.generateAccessToken(user);
        return new AuthResponse(
                token,
                user.getUsername(),
                user.getFullName(),
                user.getRole().name(),
                user.isPasswordChangeRequired());
    }
}
