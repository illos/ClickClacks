CREATE TABLE bug_reports (
  id TEXT PRIMARY KEY,
  content_hash TEXT NOT NULL,
  description TEXT NOT NULL,
  contact TEXT NOT NULL DEFAULT '',
  diagnostics TEXT,
  country TEXT,
  region TEXT,
  created_at INTEGER NOT NULL,
  private_expires_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','triaged','in-progress','needs-info','resolved','duplicate')),
  revision INTEGER NOT NULL DEFAULT 0,
  owner TEXT,
  fix_commit TEXT,
  notes TEXT NOT NULL DEFAULT ''
);
CREATE INDEX bug_reports_inbox ON bug_reports(status, created_at);
CREATE INDEX bug_reports_expiry ON bug_reports(private_expires_at);
