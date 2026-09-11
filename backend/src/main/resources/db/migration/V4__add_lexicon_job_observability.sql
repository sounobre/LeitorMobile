ALTER TABLE lexicon_jobs ADD COLUMN phase varchar(32) NOT NULL DEFAULT 'QUEUED';
ALTER TABLE lexicon_jobs ADD COLUMN last_message text;
