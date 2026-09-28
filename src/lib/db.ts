import "server-only";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

// All app data lives in ./data — the SQLite file plus uploaded documents.
export const DATA_DIR = path.join(process.cwd(), "data");
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS jobs (
  id                INTEGER PRIMARY KEY,
  company           TEXT NOT NULL,
  title             TEXT NOT NULL,
  location          TEXT NOT NULL DEFAULT '',
  url               TEXT NOT NULL DEFAULT '',
  source            TEXT NOT NULL DEFAULT '',
  description       TEXT NOT NULL DEFAULT '',
  status            TEXT NOT NULL DEFAULT 'saved',
  applied_at        TEXT,
  resume_version    TEXT NOT NULL DEFAULT '',
  notes             TEXT NOT NULL DEFAULT '',
  created_at        TEXT NOT NULL,
  status_changed_at TEXT NOT NULL
);

-- Every status change is recorded so analytics can reconstruct the funnel later.
CREATE TABLE IF NOT EXISTS status_events (
  id         INTEGER PRIMARY KEY,
  job_id     INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  status     TEXT NOT NULL,
  changed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contacts (
  id     INTEGER PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  name   TEXT NOT NULL,
  role   TEXT NOT NULL DEFAULT '',
  email  TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS interviews (
  id           INTEGER PRIMARY KEY,
  job_id       INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  scheduled_at TEXT NOT NULL,
  kind         TEXT NOT NULL DEFAULT '',
  notes        TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS tasks (
  id     INTEGER PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  text   TEXT NOT NULL,
  done   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS documents (
  id          INTEGER PRIMARY KEY,
  job_id      INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  filename    TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  uploaded_at TEXT NOT NULL
);

-- The user's profile: a single row of contact details plus the resume it was imported from.
CREATE TABLE IF NOT EXISTS profile (
  id                 INTEGER PRIMARY KEY CHECK (id = 1),
  name               TEXT NOT NULL DEFAULT '',
  headline           TEXT NOT NULL DEFAULT '',
  email              TEXT NOT NULL DEFAULT '',
  phone              TEXT NOT NULL DEFAULT '',
  location           TEXT NOT NULL DEFAULT '',
  links              TEXT NOT NULL DEFAULT '',
  resume_filename    TEXT NOT NULL DEFAULT '',
  resume_stored_name TEXT NOT NULL DEFAULT '',
  resume_imported_at TEXT
);

-- Education, experience, projects, skills and STAR stories. Items with source 'resume'
-- are replaced when a new resume is imported; items the user adds ('manual') are kept.
CREATE TABLE IF NOT EXISTS profile_items (
  id       INTEGER PRIMARY KEY,
  section  TEXT NOT NULL,
  title    TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  dates    TEXT NOT NULL DEFAULT '',
  details  TEXT NOT NULL DEFAULT '',
  source   TEXT NOT NULL DEFAULT 'manual',
  position INTEGER NOT NULL DEFAULT 0
);

-- AI-generated material for a job. One current version each; regenerating replaces it.
CREATE TABLE IF NOT EXISTS cover_letters (
  job_id     INTEGER PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  missing    TEXT NOT NULL DEFAULT '[]', -- JSON: requirements the profile doesn't cover
  guidance   TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS interview_preps (
  job_id     INTEGER PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  data       TEXT NOT NULL, -- JSON, see lib/interview-prep.ts
  created_at TEXT NOT NULL
);

-- Chat conversations. thread is 'profile' or 'interview-<job id>'.
CREATE TABLE IF NOT EXISTS chat_messages (
  id         INTEGER PRIMARY KEY,
  thread     TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS chat_messages_thread ON chat_messages (thread, id);
`;

function open() {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const db = new Database(path.join(DATA_DIR, "careeros.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

// Reuse one connection across hot reloads in development.
const globalForDb = globalThis as unknown as { careerosDb?: Database.Database };
export const db = globalForDb.careerosDb ?? open();
globalForDb.careerosDb = db;

// Every statement is CREATE IF NOT EXISTS, so this is safe to re-run and picks up new tables.
db.exec(SCHEMA);
