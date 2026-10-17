package com.sanasboutique.backend.catalog.dto.request;

import jakarta.validation.constraints.*;

/** A franchisor-created billing module: its name (shown in the outlet menu) and icon. The bill code is generated. */
public record BillingModuleRequest(
        @NotBlank(message = "Name is required") @Size(max = 60, message = "At most 60 characters") String name,
        @NotBlank @Pattern(regexp = "bag|ring|flower|gift|star|tag", message = "Choose one of the icons") String icon) {}
