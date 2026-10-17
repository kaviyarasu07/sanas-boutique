package com.sanasboutique.backend.outlet.dto.response;

import java.util.List;

public record RentalBookingPage(
        List<RentalBookingResponse> content, int page, int size, int totalPages, long totalElements) {}
