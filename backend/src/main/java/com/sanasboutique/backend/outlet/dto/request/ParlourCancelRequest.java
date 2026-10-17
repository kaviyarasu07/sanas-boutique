package com.sanasboutique.backend.outlet.dto.request;

import jakarta.validation.constraints.*;

/** reason: Customer cancelled / Didn't come / Other (comment explains). */
public record ParlourCancelRequest(
        @NotBlank @Size(max = 100) String reason,
        @Size(max = 500) String comment,
        @Size(max = 150) String authorName) {}
