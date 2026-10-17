package com.sanasboutique.backend.outlet.dto.request;

import jakarta.validation.constraints.*;

public record OutletServiceItemRequest(
        @NotNull Boolean allowed, @PositiveOrZero Integer allocatedQuantity) {}
