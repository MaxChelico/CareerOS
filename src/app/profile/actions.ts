"use server";

import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { describeError } from "@/lib/ai";
import { UPLOADS_DIR } from "@/lib/db";
import * as profile from "@/lib/profile";
import { isSection } from "@/lib/profile-sections";
import { parseResume } from "@/lib/resume-import";

function str(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function id(form: FormData): number {
  const n = Number(form.get("id"));
  if (!Number.isInteger(n) || n <= 0) throw new Error("Invalid id");
  return n;
}

function refresh() {
  revalidatePath("/profile");
}

export type ImportState = { error: string } | { ok: true } | null;

export async function importResume(_prev: ImportState, form: FormData): Promise<ImportState> {
  const file = form.get("resume");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a PDF first." };
  if (!file.name.toLowerCase().endsWith(".pdf")) return { error: "The resume needs to be a PDF." };

  const pdf = Buffer.from(await file.arrayBuffer());
  let parsed;
  try {
    parsed = await parseResume(pdf);
  } catch (err) {
    return { error: describeError(err) };
  }

  const storedName = `${randomUUID()}.pdf`;
  await fs.writeFile(path.join(UPLOADS_DIR, storedName), pdf);
  const oldFile = profile.replaceResume({ filename: file.name, stored_name: storedName }, parsed.contact, parsed.items);
  if (oldFile) await fs.rm(path.join(UPLOADS_DIR, path.basename(oldFile)), { force: true });

  refresh();
  return { ok: true };
}

export async function saveContact(form: FormData) {
  profile.updateContact({
    name: str(form, "name"),
    headline: str(form, "headline"),
    email: str(form, "email"),
    phone: str(form, "phone"),
    location: str(form, "location"),
    links: str(form, "links"),
  });
  refresh();
}

export async function addItem(form: FormData) {
  const section = str(form, "section");
  const title = str(form, "title");
  if (!isSection(section) || !title) return;
  profile.addItem({ section, title, subtitle: str(form, "subtitle"), dates: str(form, "dates"), details: str(form, "details") });
  refresh();
}

export async function updateItem(form: FormData) {
  const title = str(form, "title");
  if (!title) return;
  profile.updateItem(id(form), { title, subtitle: str(form, "subtitle"), dates: str(form, "dates"), details: str(form, "details") });
  refresh();
}

export async function deleteItem(form: FormData) {
  profile.deleteItem(id(form));
  refresh();
}
