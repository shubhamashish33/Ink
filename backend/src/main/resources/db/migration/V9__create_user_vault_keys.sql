CREATE TABLE user_vault_keys (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    password_wrapped_key TEXT NOT NULL,
    recovery_wrapped_key TEXT NOT NULL,
    encryption_version INTEGER NOT NULL DEFAULT 2,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);