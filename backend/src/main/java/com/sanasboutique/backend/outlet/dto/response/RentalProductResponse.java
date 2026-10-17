package com.sanasboutique.backend.outlet.dto.response;

import java.math.BigDecimal;

/** A rental piece: price per day (as entered on the product screen), pieces in stock now (null = not tracked), value if lost. */
public record RentalProductResponse(
        Long id, String name, String itemCode, String serviceName, BigDecimal pricePerDay, Integer inStock, BigDecimal replacementValue) {}
