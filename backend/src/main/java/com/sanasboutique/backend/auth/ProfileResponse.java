package com.sanasboutique.backend.auth;

/** The signed-in user's own details. fullName and mobileNo are fixed; username and password can be changed. */
public record ProfileResponse(String fullName, String mobileNo, String username, String role) {}
