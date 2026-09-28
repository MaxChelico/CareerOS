"use server";

import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { UPLOADS_DIR } from "@/lib/db";
import { describeError } from "@/lib/ai";
import { extractJobFromText } from "@/lib/extract-job";
import { importJobFromUrl, type ImportResult } from "@/lib/import-job";
import * as jobs from "@/lib/jobs";
import { DOCUMENT_KINDS, isStage, type StageId } from "@/lib/stages";

// CareerOS is single-user and only listens on localhost, so actions don't check auth.

function str(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function id(form: FormData, key = "id"): number {
  const n = Number(form.get(key));
  if (!Number.isInteger(n) || n <= 0) throw new Error(`Invalid ${key}`);
  return n;
}

function jobInput(form: FormData): jobs.JobInput {
  const company = str(form, "company");
  const title = str(form, "title");
  if (!company || !title) throw new Error("Company and title are required");
  return {
    company,
    title,
    location: str(form, "location"),
    url: str(form, "url"),
    source: str(form, "source"),
    description: str(form, "description"),
    resume_version: str(form, "resume_version"),
    applied_at: str(form, "applied_at") || null,
  };
}

function refresh() {
  revalidatePath("/", "layout");
}

// ---------- Jobs ----------

export async function importFromUrl(url: string) {
  return importJobFromUrl(url);
}

// The fallback for sites that can't be imported: sort a copied page into the form's fields.
export async function importFromPastedText(pasted: string): Promise<ImportResult> {
  if (pasted.trim().length < 100) return { ok: false, error: "Paste the whole job page first." };
  try {
    return { ok: true, job: await extractJobFromText(pasted) };
  } catch (err) {
    return { ok: false, error: describeError(err) };
  }
}

export async function createJob(form: FormData) {
  const status = str(form, "status");
  const jobId = jobs.createJob(jobInput(form), isStage(status) ? status : "saved");
  refresh();
  redirect(`/jobs/${jobId}`);
}

export async function updateJob(form: FormData) {
  jobs.updateJob(id(form), jobInput(form));
  refresh();
}

export async function moveJob(jobId: number, status: StageId) {
  if (!isStage(status)) throw new Error("Invalid status");
  jobs.setJobStatus(jobId, status);
  refresh();
}

// Saves the notes or the job posting text.
export async function saveJobText(form: FormData) {
  const field = str(form, "field");
  if (field !== "notes" && field !== "description") throw new Error("Invalid field");
  jobs.setJobText(id(form), field, str(form, "value"));
  refresh();
}

// Deletes a job and its uploaded files. Called directly from the board.
export async function removeJob(jobId: number) {
  if (!Number.isInteger(jobId) || jobId <= 0) throw new Error("Invalid job");
  const docs = jobs.deleteJob(jobId);
  await Promise.all(docs.map((d) => removeUpload(d.stored_name)));
  refresh();
}

// The job page's delete button: delete, then go back to the board.
export async function deleteJob(form: FormData) {
  await removeJob(id(form));
  redirect("/");
}

// ---------- Workspace items ----------

export async function addContact(form: FormData) {
  const name = str(form, "name");
  if (!name) return;
  jobs.addContact(id(form, "job_id"), { name, role: str(form, "role"), email: str(form, "email") });
  refresh();
}

export async function addInterview(form: FormData) {
  const scheduledAt = str(form, "scheduled_at");
  if (!scheduledAt) return;
  jobs.addInterview(id(form, "job_id"), { scheduled_at: scheduledAt, kind: str(form, "kind"), notes: str(form, "notes") });
  refresh();
}

export async function addTask(form: FormData) {
  const text = str(form, "text");
  if (!text) return;
  jobs.addTask(id(form, "job_id"), text);
  refresh();
}

export async function toggleTask(form: FormData) {
  jobs.toggleTask(id(form));
  refresh();
}

export async function deleteItem(form: FormData) {
  const kind = str(form, "kind");
  if (kind !== "contact" && kind !== "interview" && kind !== "task") throw new Error("Invalid kind");
  jobs.deleteChild(kind, id(form));
  refresh();
}

// ---------- Documents ----------

export async function uploadDocument(form: FormData) {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return;
  const kind = str(form, "kind");
  const safeKind = DOCUMENT_KINDS.some((k) => k.id === kind) ? kind : "other";

  // Store under a random name; the original filename is kept in the database.
  const storedName = `${randomUUID()}${path.extname(file.name).toLowerCase()}`;
  await fs.writeFile(path.join(UPLOADS_DIR, storedName), Buffer.from(await file.arrayBuffer()));
  jobs.addDocument(id(form, "job_id"), { kind: safeKind, filename: file.name, stored_name: storedName });
  refresh();
}

export async function deleteDocument(form: FormData) {
  const doc = jobs.deleteDocument(id(form));
  if (doc) await removeUpload(doc.stored_name);
  refresh();
}

async function removeUpload(storedName: string) {
  await fs.rm(path.join(UPLOADS_DIR, path.basename(storedName)), { force: true });
}
