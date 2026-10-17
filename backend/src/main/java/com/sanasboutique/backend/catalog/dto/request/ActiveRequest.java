package com.sanasboutique.backend.catalog.dto.request;

import jakarta.validation.constraints.NotNull;

/** Shared body shape for every "activate/deactivate" PATCH endpoint in the catalog. */
public record ActiveRequest(@NotNull(message = "active is required") Boolean active) {}
