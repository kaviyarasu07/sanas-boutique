package com.sanasboutique.backend.outlet.dto.response;

import java.util.List;

public record CustomerPageResponse(
        List<CustomerDetailResponse> content,
        int page,
        int size,
        int totalPages,
        long totalElements) {}
