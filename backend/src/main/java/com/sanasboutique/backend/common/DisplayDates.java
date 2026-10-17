package com.sanasboutique.backend.common;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

/**
 * The one place the date format of user-facing messages lives: dd/MM/yyyy, matching the frontend
 * (config/dateFormat.ts). API fields stay ISO yyyy-MM-dd; this is only for text people read.
 */
public final class DisplayDates {
    private static final DateTimeFormatter FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private DisplayDates() {}

    public static String format(LocalDate date) {
        return date == null ? "" : FORMAT.format(date);
    }
}
