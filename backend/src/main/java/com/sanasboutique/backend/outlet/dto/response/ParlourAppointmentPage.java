package com.sanasboutique.backend.outlet.dto.response;

import java.util.List;

public record ParlourAppointmentPage(
        List<ParlourAppointmentResponse> content, int page, int size, int totalPages, long totalElements) {}
