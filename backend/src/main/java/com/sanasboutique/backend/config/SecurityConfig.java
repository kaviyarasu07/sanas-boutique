package com.sanasboutique.backend.config;

import com.sanasboutique.backend.security.JwtAuthenticationFilter;
import com.sanasboutique.backend.security.JwtService;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * There is no sign-up flow: /api/auth/setup creates exactly one FRANCHISOR
 * account (only while none exists), and every other account is created by
 * an admin from inside the app.
 *
 * JwtAuthenticationFilter reads "Authorization: Bearer <token>" and, if
 * valid, puts an AuthenticatedUser (username, role, franchiseId - all read
 * from the token's own claims) into the SecurityContext. franchise_id must
 * always come from there, never from a request body or query param - that
 * is the #1 way a multi-tenant app leaks data across franchises.
 *
 * Franchisor-only endpoints (cross-outlet views) get their own authority
 * check via @PreAuthorize("hasRole('FRANCHISOR')") at the controller,
 * enabled by @EnableMethodSecurity below.
 *
 * exceptionHandling's authenticationEntryPoint below is what makes a
 * missing/expired token come back as 401. Without it, Spring Security's
 * fallback for "not authenticated" (with no httpBasic()/formLogin()
 * configured) is 403 - and the frontend's axios interceptor only clears
 * the stored token on 401, so a 403 here would leave a dead token sitting
 * in localStorage forever, getting resent and rejected on every request.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, JwtService jwtService)
            throws Exception {
        http.csrf(csrf -> csrf.disable()) // stateless JWT API, no cookies/CSRF exposure
                .sessionManagement(
                        session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(
                        exceptions ->
                                exceptions.authenticationEntryPoint(
                                        new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                .authorizeHttpRequests(
                        auth ->
                                auth.requestMatchers("/actuator/health", "/actuator/info")
                                        .permitAll()
                                        .requestMatchers(
                                                "/api/auth/change-password", "/api/auth/me")
                                        .authenticated()
                                        .requestMatchers("/api/auth/**")
                                        .permitAll()
                                        // Spring re-dispatches sendError() responses (400, 404, 500...)
                                        // to /error. Without this they came back as 401, and the
                                        // frontend treats any 401 as "session expired" and signs out.
                                        .dispatcherTypeMatchers(jakarta.servlet.DispatcherType.ERROR)
                                        .permitAll()
                                        .requestMatchers("/api/ping")
                                        .permitAll() // TODO: remove once real endpoints exist
                                        .anyRequest()
                                        .authenticated())
                .addFilterBefore(
                        new JwtAuthenticationFilter(jwtService),
                        UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
