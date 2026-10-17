package com.sanasboutique.backend.outlet.dto.response;

import java.util.List;

public record StitchPageResponse(
        List<StitchOrderResponse> content,
        int page,
        int size,
        int totalPages,
        long totalElements) {}
