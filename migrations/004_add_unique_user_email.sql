-- Ensure primary_email supports ON CONFLICT in user upsert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_users_primary_email_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_users_primary_email_unique ON users(primary_email);
  END IF;
END $$;
