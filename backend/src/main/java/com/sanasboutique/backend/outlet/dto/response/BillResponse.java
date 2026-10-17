package com.sanasboutique.backend.outlet.dto.response;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** module: RENTAL / PARLOUR / SALES / STITCHING. type: BILL or CHALLAN (no amount, not a sale). advancePaid: advance used on this bill (stitching); balance = total - advancePaid. */
public record BillResponse(
        Long id,
        String billNumber,
        String shopName,
        String shopAddress,
        String customerName,
        String customerMobile,
        BigDecimal discount,
        BigDecimal subtotal,
        BigDecimal total,
        Instant createdAt,
        List<BillItemResponse> items,
        String module,
        String type,
        BigDecimal advancePaid,
        BigDecimal balance) {}
