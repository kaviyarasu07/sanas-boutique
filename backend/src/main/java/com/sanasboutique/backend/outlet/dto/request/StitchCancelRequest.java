package com.sanasboutique.backend.outlet.dto.request;

import jakarta.validation.constraints.*;

import java.util.List;

/** itemIds: garments to cancel; empty = every garment not yet delivered. */
public record StitchCancelRequest(
        List<@NotNull Long> itemIds,
        @NotBlank @Size(max = 100) String reason,
        @Size(max = 500) String comment,
        @Size(max = 150) String authorName) {}
