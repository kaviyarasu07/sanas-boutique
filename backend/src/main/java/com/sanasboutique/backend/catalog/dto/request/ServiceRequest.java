package com.sanasboutique.backend.catalog.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ServiceRequest(
        @NotBlank(message = "Name is required") @Size(max = 150, message = "At most 150 characters")
                String name,
        @Size(max = 255, message = "At most 255 characters") String description,
        @NotNull(message = "Price unit is required") Long priceUnitId,
        @jakarta.validation.constraints.Pattern(
                        regexp = "RENTAL|APPOINTMENT|DELIVERY|NONE",
                        message = "Unknown booking type")
                String bookingMode,
        Boolean prebookEnabled,
        // The outlet module this service opens; outlets given this service see that module. Default: Shop sales.
        @jakarta.validation.constraints.Pattern(
                        regexp = "RENTAL|PARLOUR|STITCHING|SALES|CUSTOM",
                        message = "Choose Jewellery rental, Parlour, Stitching, Shop sales or a billing module")
                String module,
        // With module CUSTOM: the franchisor-created billing module this service is billed in.
        Long billingModuleId) {}
