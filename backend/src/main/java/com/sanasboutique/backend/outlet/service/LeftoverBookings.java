package com.sanasboutique.backend.outlet.service;

import com.sanasboutique.backend.outlet.repository.OutletRepository;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * The daily check at login (owner decision: no scheduler). When an outlet logs in, that outlet's
 * leftovers from earlier days are cancelled by the system: parlour appointments not done, and rental
 * pre-bookings not collected by their date. Each module runs in its own transaction; a failure is
 * logged and never blocks the login (the same check runs again when the module screen is opened).
 */
@Component
public class LeftoverBookings {
    private static final Logger log = LoggerFactory.getLogger(LeftoverBookings.class);
    private final OutletRepository outlets;
    private final ParlourService parlour;
    private final RentalService rental;

    public LeftoverBookings(OutletRepository outlets, ParlourService parlour, RentalService rental) {
        this.outlets = outlets;
        this.parlour = parlour;
        this.rental = rental;
    }

    /** Runs for the outlet of this franchise (outlet logins only). */
    public void cancelAtLogin(Long franchiseId) {
        if (franchiseId == null) return;
        outlets.findByFranchiseId(franchiseId).ifPresent(o -> {
            try {
                int p = parlour.sweepOutlet(o.getId());
                int r = rental.sweepOutlet(o.getId());
                if (p + r > 0) log.info("Login check for outlet {}: cancelled {} parlour and {} rental bookings", o.getId(), p, r);
            } catch (RuntimeException e) {
                log.error("Login check failed for outlet {}", o.getId(), e);
            }
        });
    }
}
