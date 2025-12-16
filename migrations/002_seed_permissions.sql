INSERT INTO permissions(role, permission_name)
VALUES
	('admin', 'adminJobs.run'),
	('admin', 'docs.view')
ON CONFLICT DO NOTHING;
