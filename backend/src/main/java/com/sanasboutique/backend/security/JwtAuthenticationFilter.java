package com.sanasboutique.backend.security;

import io.jsonwebtoken.JwtException;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Reads "Authorization: Bearer <token>", and if it's a valid access token,
 * puts an AuthenticatedUser (username, role, franchiseId - all from the
 * token's own claims) into the SecurityContext. An invalid/missing token
 * just leaves the request unauthenticated; SecurityConfig's
 * anyRequest().authenticated() is what turns that into a 401.
 */
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;

    public JwtAuthenticationFilter(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain)
            throws ServletException, IOException {

        String header = request.getHeader("Authorization");

        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7);
            try {
                var claims = jwtService.parseClaims(token);
                String username = jwtService.extractUsername(claims);
                String role = jwtService.extractRole(claims);
                Long franchiseId = jwtService.extractFranchiseId(claims);

                if (jwtService.extractMustChangePassword(claims)
                        && !"/api/auth/change-password".equals(request.getRequestURI())
                        && !"/api/auth/me".equals(request.getRequestURI())) {
                    // First login with a system-generated password: nothing else works until it is
                    // changed.
                    response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                    response.setContentType("application/json");
                    response.getWriter()
                            .write(
                                    "{\"status\":403,\"error\":\"PASSWORD_CHANGE_REQUIRED\",\"message\":\"Change"
                                        + " your password to continue\"}");
                    return;
                }
                var principal = new AuthenticatedUser(username, role, franchiseId);
                var authorities = List.of(new SimpleGrantedAuthority("ROLE_" + role));
                var authentication =
                        new UsernamePasswordAuthenticationToken(principal, null, authorities);

                SecurityContextHolder.getContext().setAuthentication(authentication);
            } catch (JwtException | IllegalArgumentException ex) {
                // Bad/expired token: leave unauthenticated, don't fail the request here.
                SecurityContextHolder.clearContext();
            }
        }

        filterChain.doFilter(request, response);
    }
}
