package com.sanasboutique.backend.outlet.dto.request;

import jakarta.validation.constraints.*;

/** A staff comment on a booking timeline. authorName: optional "Your name". */
public record CommentRequest(
        @NotBlank @Size(max = 1000) String text, @Size(max = 150) String authorName) {}
