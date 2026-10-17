package com.sanasboutique.backend.outlet.dto.request;

import jakarta.validation.constraints.NotNull;

public record OutletServiceToggleRequest(@NotNull Boolean allowed) {}
