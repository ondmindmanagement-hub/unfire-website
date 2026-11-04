-- Daily anonymous event counts. No IP addresses, URLs, identities or purchases.
CREATE TABLE IF NOT EXISTS daily_counts (
  day TEXT NOT NULL,
  event TEXT NOT NULL,
  total INTEGER NOT NULL DEFAULT 0 CHECK(total >= 0),
  PRIMARY KEY(day, event)
);
-- Ephemeral random per-browser-tab sessions; purged after ~35 days.
CREATE TABLE IF NOT EXISTS daily_sessions (
  day TEXT NOT NULL,
  event TEXT NOT NULL,
  session TEXT NOT NULL,
  PRIMARY KEY(day, event, session)
);
CREATE INDEX IF NOT EXISTS daily_sessions_day_idx ON daily_sessions(day);
