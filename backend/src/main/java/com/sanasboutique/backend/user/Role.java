package com.sanasboutique.backend.user;

/**
 * FRANCHISOR: cross-outlet admin, franchiseId is always null, sees every
 * franchise. Created once via the setup screen, never again after that.
 *
 * FRANCHISE_OWNER / STAFF: scoped to exactly one franchiseId. Created by an
 * admin from inside the app - there is no public sign-up for these either.
 */
public enum Role {
    FRANCHISOR,
    FRANCHISE_OWNER,
    STAFF,
    OUTLET
}
