package com.sanasboutique.backend.outlet.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * SWITCHED OFF (owner decision 2026-10-11: no scheduler; the check runs at each outlet's login and
 * when a module screen is opened). Kept only so it can be turned back on with
 * app.jobs.parlour-auto-cancel.enabled=true. When on: every morning at 6:00 AM (India time): cancels parlour appointments
 * of earlier days that are still Booked ("Not done by end of day"). Each outlet runs in its own
 * transaction (ParlourService.sweepOutlet), so one failure does not stop the others.
 *
 * On Cloud Run the app may not be running at 6 AM; the same sweep then runs the first time anyone
 * opens Parlour that day (ParlourService.ensureSwept). Switch off with
 * app.jobs.parlour-auto-cancel.enabled=false (e.g. in tests).
 */
@Component
@ConditionalOnProperty(name = "app.jobs.parlour-auto-cancel.enabled", havingValue = "true")
public class ParlourAutoCancelJob {
    private static final Logger log = LoggerFactory.getLogger(ParlourAutoCancelJob.class);
    private final ParlourService parlour;

    public ParlourAutoCancelJob(ParlourService parlour) {
        this.parlour = parlour;
    }

    @Scheduled(cron = "0 0 6 * * *", zone = "Asia/Kolkata")
    public void run() {
        int cancelled = 0, outlets = 0;
        for (Long outletId : parlour.outletsToSweep()) {
            try {
                cancelled += parlour.sweepOutlet(outletId);
                outlets++;
            } catch (RuntimeException e) {
                log.error("Parlour auto-cancel failed for outlet {}", outletId, e);
            }
        }
        log.info("Parlour auto-cancel: cancelled {} bookings in {} outlets", cancelled, outlets);
    }
}
