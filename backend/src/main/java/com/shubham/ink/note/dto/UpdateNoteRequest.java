package com.shubham.ink.note.dto;

import java.util.Set;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UpdateNoteRequest(
    @Size(max=255) String title,
    String content,
    Set<@Size(max = 64) String> tags,
    @NotBlank String encryptedPayload,
    @NotNull Long version
) {
    public UpdateNoteRequest(String title, String content, Set<String> tags, Long version) {
        this(title, content, tags, null, version);
    }

    public UpdateNoteRequest(String encryptedPayload, Long version) {
        this("", "encrypted", Set.of(), encryptedPayload, version);
    }
}
