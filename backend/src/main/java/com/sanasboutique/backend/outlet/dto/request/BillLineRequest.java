package com.sanasboutique.backend.outlet.dto.request;

import jakarta.validation.constraints.*;

public record BillLineRequest(@NotNull Long itemId, @Min(1) @Max(10000) int quantity) {}
