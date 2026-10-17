package com.sanasboutique.backend.outlet.dto.request;

import jakarta.validation.constraints.Size;

/** A one-tap action that only records who did it ("Your name", optional). */
public record AuthorRequest(@Size(max = 150) String authorName) {}
