CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_sub TEXT,
  actor_roles TEXT[] NULL,
  action TEXT NOT NULL,
  resource TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'failure')),
  error TEXT,
  meta JSONB
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_sub ON audit_log (actor_sub);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log (action);
