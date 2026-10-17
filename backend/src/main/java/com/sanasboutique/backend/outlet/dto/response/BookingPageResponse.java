package com.sanasboutique.backend.outlet.dto.response;

import java.util.List;

public record BookingPageResponse(
        List<BookingResponse> content, int page, int size, int totalPages, long totalElements) {}
