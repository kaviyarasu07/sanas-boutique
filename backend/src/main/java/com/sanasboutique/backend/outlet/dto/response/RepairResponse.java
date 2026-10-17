package com.sanasboutique.backend.outlet.dto.response;

import java.time.LocalDate;

/** A damaged piece sent for repair at a rental return. */
public record RepairResponse(
        Long id,
        Long itemId,
        String itemName,
        String itemCode,
        int quantity,
        String note,
        LocalDate sentOn,
        String bookingNumber,
        String customerName) {}
