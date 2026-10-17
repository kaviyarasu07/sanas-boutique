package com.sanasboutique.backend.outlet.dto.request;

import jakarta.validation.constraints.*;

/** NOT_STARTED, STARTED or FINISHED (moving back is allowed). */
public record StitchStatusRequest(@NotBlank String status, @Size(max = 150) String authorName) {}
