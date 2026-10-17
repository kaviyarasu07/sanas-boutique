package com.sanasboutique.backend.outlet.dto.request;

import jakarta.validation.constraints.*;

public record StitchCommentRequest(
        @NotBlank @Size(max = 1000) String text, @Size(max = 150) String authorName) {}
