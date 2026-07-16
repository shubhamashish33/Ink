package com.shubham.ink.common.exception;

import java.util.UUID;

public class NoteVersionConflictException extends RuntimeException {

    private final UUID noteId;
    private final long currentVersion;

    public NoteVersionConflictException(UUID noteId, long currentVersion) {
        super("A newer version of this note is available. Refresh before saving your changes.");
        this.noteId = noteId;
        this.currentVersion = currentVersion;
    }

    public UUID getNoteId() {
        return noteId;
    }

    public long getCurrentVersion() {
        return currentVersion;
    }
}
