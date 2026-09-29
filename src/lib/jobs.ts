import "server-only";
import { db } from "./db";
import { now, today } from "./dates";
import type { StageId } from "./stages";
import type { JobType, TypeColor } from "./type-colors";

export type Job = {
  id: number;
  company: string;
  title: string;
  location: string;
  url: string;
  source: string;
  description: string;
  status: StageId;
  applied_at: string | null;
  resume_version: string;
  notes: string;
  created_at: string;
  status_changed_at: string;
  type_id: number | null;
};

// The subset of a job the board needs — keeps long descriptions out of the page payload.
export type JobCard = Pick<
  Job,
  "id" | "company" | "title" | "location" | "status" | "applied_at" | "created_at" | "status_changed_at" | "type_id"
> & { next_interview: string | null };

export type Contact = { id: number; job_id: number; name: string; role: string; email: string };
export type Interview = { id: number; job_id: number; scheduled_at: string; kind: string; notes: string };
export type Task = { id: number; job_id: number; text: string; done: number };
export type Document = {
  id: number;
  job_id: number;
  kind: string;
  filename: string;
  stored_name: string;
  uploaded_at: string;
};

export type JobInput = Pick<
  Job,
  "company" | "title" | "location" | "url" | "source" | "description" | "resume_version" | "type_id"
> & { applied_at: string | null };

// ---------- Reads ----------

export function listJobCards(): JobCard[] {
  return db
    .prepare(
      `SELECT j.id, j.company, j.title, j.location, j.status, j.applied_at, j.created_at, j.status_changed_at, j.type_id,
              (SELECT MIN(scheduled_at) FROM interviews i
                WHERE i.job_id = j.id AND i.scheduled_at >= ?) AS next_interview
       FROM jobs j
       ORDER BY j.status_changed_at DESC`,
    )
    .all(today()) as JobCard[];
}

export function getJob(id: number): Job | undefined {
  return db.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as Job | undefined;
}

export function getJobWorkspace(id: number) {
  const job = getJob(id);
  if (!job) return undefined;
  return {
    job,
    contacts: db.prepare("SELECT * FROM contacts WHERE job_id = ? ORDER BY id").all(id) as Contact[],
    interviews: db
      .prepare("SELECT * FROM interviews WHERE job_id = ? ORDER BY scheduled_at")
      .all(id) as Interview[],
    tasks: db.prepare("SELECT * FROM tasks WHERE job_id = ? ORDER BY done, id").all(id) as Task[],
    documents: db
      .prepare("SELECT * FROM documents WHERE job_id = ? ORDER BY uploaded_at DESC")
      .all(id) as Document[],
  };
}

export function listResumeVersions(): string[] {
  return (
    db
      .prepare("SELECT DISTINCT resume_version FROM jobs WHERE resume_version != '' ORDER BY resume_version DESC")
      .all() as { resume_version: string }[]
  ).map((r) => r.resume_version);
}

export function getDocument(id: number): Document | undefined {
  return db.prepare("SELECT * FROM documents WHERE id = ?").get(id) as Document | undefined;
}

// ---------- Writes ----------

export function createJob(input: JobInput, status: StageId): number {
  return db.transaction(() => {
    const stamp = now();
    const appliedAt = input.applied_at ?? (status === "saved" ? null : today());
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO jobs (company, title, location, url, source, description, resume_version, type_id,
                           status, applied_at, created_at, status_changed_at)
         VALUES (@company, @title, @location, @url, @source, @description, @resume_version, @type_id,
                 @status, @applied_at, @stamp, @stamp)`,
      )
      .run({ ...input, status, applied_at: appliedAt, stamp });
    const id = Number(lastInsertRowid);
    db.prepare("INSERT INTO status_events (job_id, status, changed_at) VALUES (?, ?, ?)").run(id, status, stamp);
    return id;
  })();
}

// Updates the short details fields; the long text fields are saved with setJobText.
export function updateJob(id: number, input: Omit<JobInput, "description">) {
  const { company, title, location, url, source, resume_version, applied_at, type_id } = input;
  db.prepare(
    `UPDATE jobs SET company = @company, title = @title, location = @location, url = @url,
                     source = @source, resume_version = @resume_version, applied_at = @applied_at,
                     type_id = @type_id
     WHERE id = @id`,
  ).run({ company, title, location, url, source, resume_version, applied_at, type_id, id });
}

export type JobTextField = "notes" | "description";

export function setJobText(id: number, field: JobTextField, value: string) {
  const column = field === "notes" ? "notes" : "description";
  db.prepare(`UPDATE jobs SET ${column} = ? WHERE id = ?`).run(value, id);
}

export function setJobStatus(id: number, status: StageId) {
  db.transaction(() => {
    const job = getJob(id);
    if (!job || job.status === status) return;
    const stamp = now();
    // Moving past "Saved" for the first time counts as applying today.
    const appliedAt = job.applied_at ?? (status === "saved" ? null : today());
    db.prepare("UPDATE jobs SET status = ?, status_changed_at = ?, applied_at = ? WHERE id = ?").run(
      status,
      stamp,
      appliedAt,
      id,
    );
    db.prepare("INSERT INTO status_events (job_id, status, changed_at) VALUES (?, ?, ?)").run(id, status, stamp);
  })();
}

export function deleteJob(id: number): Document[] {
  const docs = db.prepare("SELECT * FROM documents WHERE job_id = ?").all(id) as Document[];
  db.prepare("DELETE FROM jobs WHERE id = ?").run(id);
  // Chat threads aren't linked by a foreign key, so remove this job's practice interview explicitly.
  db.prepare("DELETE FROM chat_messages WHERE thread = ?").run(`interview-${id}`);
  return docs;
}

export function addContact(jobId: number, c: Pick<Contact, "name" | "role" | "email">) {
  db.prepare("INSERT INTO contacts (job_id, name, role, email) VALUES (?, ?, ?, ?)").run(jobId, c.name, c.role, c.email);
}

export function addInterview(jobId: number, i: Pick<Interview, "scheduled_at" | "kind" | "notes">) {
  db.prepare("INSERT INTO interviews (job_id, scheduled_at, kind, notes) VALUES (?, ?, ?, ?)").run(
    jobId,
    i.scheduled_at,
    i.kind,
    i.notes,
  );
}

export function addTask(jobId: number, text: string) {
  db.prepare("INSERT INTO tasks (job_id, text) VALUES (?, ?)").run(jobId, text);
}

export function toggleTask(id: number) {
  db.prepare("UPDATE tasks SET done = 1 - done WHERE id = ?").run(id);
}

export function addDocument(jobId: number, d: Pick<Document, "kind" | "filename" | "stored_name">) {
  db.prepare("INSERT INTO documents (job_id, kind, filename, stored_name, uploaded_at) VALUES (?, ?, ?, ?, ?)").run(
    jobId,
    d.kind,
    d.filename,
    d.stored_name,
    now(),
  );
}

export function deleteDocument(id: number): Document | undefined {
  const doc = getDocument(id);
  db.prepare("DELETE FROM documents WHERE id = ?").run(id);
  return doc;
}

// Contacts, interviews and tasks are deleted the same way.
const CHILD_TABLES = { contact: "contacts", interview: "interviews", task: "tasks" } as const;
export type ChildKind = keyof typeof CHILD_TABLES;

export function deleteChild(kind: ChildKind, id: number) {
  db.prepare(`DELETE FROM ${CHILD_TABLES[kind]} WHERE id = ?`).run(id);
}

// ---------- Job types (e.g. Aerospace, Finance), each with a colour ----------

export function listJobTypes(): JobType[] {
  return db.prepare("SELECT * FROM job_types ORDER BY position, id").all() as JobType[];
}

export function jobTypeExists(id: number): boolean {
  return Boolean(db.prepare("SELECT 1 FROM job_types WHERE id = ?").get(id));
}

// Returns false if another type already has this name.
export function addJobType(name: string, color: TypeColor): boolean {
  const { next } = db.prepare("SELECT COALESCE(MAX(position), -1) + 1 AS next FROM job_types").get() as { next: number };
  return db.prepare("INSERT OR IGNORE INTO job_types (name, color, position) VALUES (?, ?, ?)").run(name, color, next).changes > 0;
}

// Returns false if another type already has this name.
export function updateJobType(id: number, name: string, color: TypeColor): boolean {
  const clash = db.prepare("SELECT 1 FROM job_types WHERE name = ? AND id != ?").get(name, id);
  if (clash) return false;
  db.prepare("UPDATE job_types SET name = ?, color = ? WHERE id = ?").run(name, color, id);
  return true;
}

// Jobs of this type become untyped (the foreign key is ON DELETE SET NULL).
export function deleteJobType(id: number) {
  db.prepare("DELETE FROM job_types WHERE id = ?").run(id);
}

export function countJobsByType(): Map<number, number> {
  const rows = db
    .prepare("SELECT type_id, COUNT(*) AS n FROM jobs WHERE type_id IS NOT NULL GROUP BY type_id")
    .all() as { type_id: number; n: number }[];
  return new Map(rows.map((r) => [r.type_id, r.n]));
}
