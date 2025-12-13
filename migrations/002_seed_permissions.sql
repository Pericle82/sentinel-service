INSERT INTO permissions(role, permission_name)
VALUES ('admin', 'adminJobs.run')
ON CONFLICT DO NOTHING;
