package com.sanasboutique.backend.common;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

/**
 * Unauthenticated smoke-test endpoint used only to confirm the frontend can
 * reach the backend during initial setup. Safe to delete once real
 * endpoints exist.
 */
@RestController
public class PingController {

    @GetMapping("/api/ping")
    public Map<String, Object> ping() {
        return Map.of(
                "status", "ok",
                "service", "sanas-boutique-backend",
                "time", Instant.now().toString());
    }
}
