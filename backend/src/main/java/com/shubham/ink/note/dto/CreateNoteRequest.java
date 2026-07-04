package com.shubham.ink.note.dto;

import java.util.Set;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateNoteRequest(
    @NotBlank @Size(max=255) String title,
    @NotBlank String content,
    Set<@Size(max = 64) String> tags
) {
}
