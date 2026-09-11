CREATE TABLE app_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(320) NOT NULL UNIQUE,
    password_hash VARCHAR(200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE session_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash VARCHAR(128) NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE books ADD COLUMN user_id UUID REFERENCES app_users(id) ON DELETE CASCADE;
CREATE INDEX idx_books_user ON books (user_id, last_opened_at DESC, imported_at DESC);
CREATE INDEX idx_sessions_token ON session_tokens (token_hash, expires_at);

ALTER TABLE books DROP CONSTRAINT IF EXISTS books_file_hash_key;
CREATE UNIQUE INDEX uq_books_user_file_hash ON books (user_id, file_hash);
