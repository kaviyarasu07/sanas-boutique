package com.sanasboutique.backend.common;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.util.Locale;

/** Money in user-facing text (log lines, messages): "₹1,23,456" or "₹950.50" (Indian digit grouping). */
public final class DisplayMoney {
    private DisplayMoney() {}

    public static String rupees(BigDecimal amount) {
        NumberFormat f = NumberFormat.getNumberInstance(Locale.of("en", "IN"));
        f.setMinimumFractionDigits(0);
        f.setMaximumFractionDigits(2);
        return "₹" + f.format(amount == null ? BigDecimal.ZERO : amount);
    }
}
