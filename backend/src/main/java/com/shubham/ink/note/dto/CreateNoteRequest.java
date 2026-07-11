package com.shubham.ink.note.dto;

import java.util.Set;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateNoteRequest(
    @Size(max=255) String title,
    String content,
    Set<@Size(max = 64) String> tags,
    @NotBlank String encryptedPayload
) {
    public CreateNoteRequest(String title, String content, Set<String> tags) { this(title, content, tags, null); }
    public CreateNoteRequest(String encryptedPayload) { this("", "encrypted", Set.of(), encryptedPayload); }
}
