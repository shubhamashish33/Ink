package com.shubham.ink.note.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateNoteRequest(
    @NotBlank @Size(max=255) String title,
    @NotBlank String content
) {
}
