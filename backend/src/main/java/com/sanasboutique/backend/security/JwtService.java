package com.sanasboutique.backend.security;

import com.sanasboutique.backend.user.AppUser;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;

import javax.crypto.SecretKey;

/**
 * Issues and reads the JWT. franchiseId and role are embedded as claims so
 * every request carries its own tenant scope - the server never has to
 * trust a franchiseId supplied by the client elsewhere.
 */
@Service
public class JwtService {

    private static final String CLAIM_ROLE = "role";
    private static final String CLAIM_FRANCHISE_ID = "franchiseId";
    private static final String CLAIM_MUST_CHANGE = "mustChangePassword";
    private static final String CLAIM_FULL_NAME = "fullName";

    private final SecretKey signingKey;
    private final long accessTokenTtlMinutes;

    public JwtService(
            @Value("${app.jwt.secret}") String secret,
            @Value("${app.jwt.access-token-ttl-minutes}") long accessTokenTtlMinutes) {
        this.signingKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.accessTokenTtlMinutes = accessTokenTtlMinutes;
    }

    public String generateAccessToken(AppUser user) {
        Instant now = Instant.now();
        var builder =
                Jwts.builder()
                        .subject(user.getUsername())
                        .claim(CLAIM_ROLE, user.getRole().name())
                        .claim(CLAIM_MUST_CHANGE, user.isPasswordChangeRequired())
                        .claim(CLAIM_FULL_NAME, user.getFullName())
                        .issuedAt(Date.from(now))
                        .expiration(Date.from(now.plus(accessTokenTtlMinutes, ChronoUnit.MINUTES)))
                        .signWith(signingKey);

        if (user.getFranchiseId() != null) {
            builder.claim(CLAIM_FRANCHISE_ID, user.getFranchiseId());
        }

        return builder.compact();
    }

    /** Throws io.jsonwebtoken.JwtException (unchecked) if invalid/expired. */
    public Claims parseClaims(String token) {
        return Jwts.parser().verifyWith(signingKey).build().parseSignedClaims(token).getPayload();
    }

    public String extractUsername(Claims claims) {
        return claims.getSubject();
    }

    public String extractRole(Claims claims) {
        return claims.get(CLAIM_ROLE, String.class);
    }

    public boolean extractMustChangePassword(Claims claims) {
        return Boolean.TRUE.equals(claims.get(CLAIM_MUST_CHANGE, Boolean.class));
    }

    public Long extractFranchiseId(Claims claims) {
        Number value = claims.get(CLAIM_FRANCHISE_ID, Number.class);
        return value == null ? null : value.longValue();
    }
}
