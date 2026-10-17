package com.sanasboutique.backend.outlet.dto.response;

import java.math.BigDecimal;
import java.util.List;

/** One parlour service (e.g. "Facial") with its items, for the button grid. */
public record ParlourServiceGroup(Long serviceId, String serviceName, List<Item> items) {
    public record Item(Long id, String name, BigDecimal price, String itemCode) {}
}
