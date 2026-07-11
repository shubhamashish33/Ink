ALTER TABLE notes ADD COLUMN encrypted_payload TEXT;
ALTER TABLE notes ALTER COLUMN title DROP NOT NULL;
ALTER TABLE notes ALTER COLUMN content DROP NOT NULL;

-- Existing plaintext columns are intentionally retained. A future client
-- migration can encrypt old notes after the user unlocks them.
