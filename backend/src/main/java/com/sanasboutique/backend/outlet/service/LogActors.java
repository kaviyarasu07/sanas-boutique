package com.sanasboutique.backend.outlet.service;

import com.sanasboutique.backend.user.AppUser;
import com.sanasboutique.backend.user.AppUserRepository;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Resolves the author of a timeline step: "Your name" if staff typed one (one login per outlet
 * today), else the signed-in login's name. Per-person names come automatically with staff logins.
 */
@Component
public class LogActors {
    private final AppUserRepository users;

    public LogActors(AppUserRepository users) {
        this.users = users;
    }

    @Transactional(readOnly = true)
    public LogActor of(String username, String typedName) {
        AppUser user = username == null ? null : users.findByUsernameIgnoreCase(username).orElse(null);
        String login = user != null && user.getFullName() != null ? user.getFullName() : username;
        String typed = typedName == null || typedName.isBlank() ? null : typedName.trim();
        return new LogActor(user, typed != null ? typed : (login == null ? "Staff" : login));
    }
}
