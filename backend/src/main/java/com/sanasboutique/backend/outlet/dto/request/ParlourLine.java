package com.sanasboutique.backend.outlet.dto.request;

import jakarta.validation.constraints.*;

/** One parlour service and how many (e.g. 2 × threading for two people). The price is always the service's own. */
public record ParlourLine(@NotNull Long itemId, @Min(1) @Max(100) int quantity) {}
