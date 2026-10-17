package com.sanasboutique.backend.outlet.dto.response;

import java.time.LocalDate;

/** An earlier garment's measurements, offered as "Use previous measurements". */
public record StitchMeasurementResponse(
        Long itemId, String garment, String measurements, LocalDate measuredOn, String orderNumber) {}
