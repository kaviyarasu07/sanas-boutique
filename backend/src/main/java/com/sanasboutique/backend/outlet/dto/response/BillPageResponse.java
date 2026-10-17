package com.sanasboutique.backend.outlet.dto.response;

import java.util.List;

public record BillPageResponse(
        List<BillResponse> content, int page, int size, int totalPages, long totalElements) {}
