import "server-only";
import { profileAsText } from "./ai";
import { db } from "./db";
import { getProfile } from "./profile";

export type ResumeVersion = { id: number; filename: string; imported_at: string; profile_text: string };

// Called right after a resume import: remember the profile exactly as that resume produced it.
export function recordResumeVersion(filename: string, importedAt: string) {
  db.prepare("INSERT INTO resume_versions (filename, imported_at, profile_text) VALUES (?, ?, ?)").run(
    filename,
    importedAt,
    profileAsText(),
  );
}

/** All imported versions, oldest first. */
export function listResumeHistory(): ResumeVersion[] {
  // Profiles imported before version history existed have no snapshot yet; record the current one
  // so there's always a starting point to compare future imports against.
  const profile = getProfile();
  const count = (db.prepare("SELECT COUNT(*) AS n FROM resume_versions").get() as { n: number }).n;
  if (count === 0 && profile?.resume_imported_at) {
    recordResumeVersion(profile.resume_filename, profile.resume_imported_at);
  }
  return db.prepare("SELECT * FROM resume_versions ORDER BY imported_at, id").all() as ResumeVersion[];
}
