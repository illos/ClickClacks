-- Anonymous traffic only. Never store IPs, URLs, names or room credentials here.
CREATE TABLE IF NOT EXISTS metrics_visitors (
  scope TEXT NOT NULL CHECK(scope IN ('website', 'app')),
  period TEXT NOT NULL,
  browser_hash TEXT NOT NULL,
  PRIMARY KEY(scope, period, browser_hash)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS metrics_visitors_by_period ON metrics_visitors(period);
CREATE TABLE IF NOT EXISTS metrics_sessions (
  scope TEXT NOT NULL CHECK(scope IN ('website', 'app')),
  browser_hash TEXT NOT NULL,
  window INTEGER NOT NULL,
  day TEXT NOT NULL,
  country TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(scope, browser_hash, window)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS metrics_sessions_by_expiry ON metrics_sessions(created_at);
CREATE TABLE IF NOT EXISTS metrics_counts (
  scope TEXT NOT NULL,
  day TEXT NOT NULL,
  country TEXT NOT NULL,
  visits INTEGER NOT NULL,
  PRIMARY KEY(scope, day, country)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS metrics_counts_by_day ON metrics_counts(day);
CREATE TRIGGER IF NOT EXISTS metrics_session_count AFTER INSERT ON metrics_sessions
BEGIN
  INSERT INTO metrics_counts (scope, day, country, visits) VALUES (NEW.scope, NEW.day, NEW.country, 1)
  ON CONFLICT(scope, day, country) DO UPDATE SET visits = visits + 1;
END;
