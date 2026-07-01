ALTER TABLE notes
ADD COLUMN archived BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN pinned BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX idx_notes_user_archived_updated_at
ON notes(user_id, archived, updated_at DESC);

CREATE INDEX idx_notes_user_pinned_updated_at
ON notes(user_id, pinned DESC, updated_at DESC);