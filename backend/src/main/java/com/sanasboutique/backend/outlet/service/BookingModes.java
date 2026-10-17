package com.sanasboutique.backend.outlet.service;

import com.sanasboutique.backend.catalog.entity.ServiceItem;

/** How an item can be pre-booked ("NONE" when the service does not allow pre-booking): RENTAL, APPOINTMENT, DELIVERY or NONE. The admin sets it per service; unset falls back to the price unit / stock tracking. */
public final class BookingModes {
    private BookingModes() {}

    public static String effective(ServiceItem item) {
        if (!item.getService().isPrebookEnabled()) return "NONE";
        String m = item.getService().getBookingMode();
        if (m != null) return m;
        if ("Per Day".equalsIgnoreCase(item.getService().getPriceUnit().getName())) return "RENTAL";
        return item.getQuantity() == null ? "APPOINTMENT" : "NONE";
    }
}
