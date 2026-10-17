package com.sanasboutique.backend.outlet.dto.request;

import jakarta.validation.constraints.Size;

/** Order-level details: the order note and the fabric (fabricSource OWN / IN_HOUSE; fabricBillId optional, implies IN_HOUSE). */
public record StitchOrderUpdateRequest(
        @Size(max = 1000) String notes,
        String fabricSource,
        Long fabricBillId,
        @Size(max = 150) String authorName) {}
