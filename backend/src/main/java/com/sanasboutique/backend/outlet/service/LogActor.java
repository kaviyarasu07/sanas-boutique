package com.sanasboutique.backend.outlet.service;

import com.sanasboutique.backend.user.AppUser;

/** Who did a step, for an order/booking timeline: the signed-in user (null for system jobs) and the name to show. */
public record LogActor(AppUser user, String name) {
    /** Steps done by a scheduled job, e.g. the 6:00 AM parlour auto-cancel. */
    public static final LogActor SYSTEM = new LogActor(null, "System");
}
