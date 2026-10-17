package com.sanasboutique.backend.catalog.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PriceUnitRequest(
        @NotBlank(message = "Name is required") @Size(max = 50, message = "At most 50 characters")
                String name) {}
