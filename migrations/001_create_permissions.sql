CREATE TABLE IF NOT EXISTS permissions (
  role TEXT NOT NULL,
  permission_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role, permission_name)
);

CREATE INDEX IF NOT EXISTS idx_permissions_role_active
  ON permissions(role)
  WHERE is_active = TRUE;
