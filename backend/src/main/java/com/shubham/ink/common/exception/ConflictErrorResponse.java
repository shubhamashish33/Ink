package com.shubham.ink.common.exception;

import java.time.Instant;
import java.util.UUID;

public record ConflictErrorResponse(
    Instant timestamp,
    int status,
    String error,
    String code,
    String message,
    String path,
    UUID noteId,
    Long currentVersion
) {
}
