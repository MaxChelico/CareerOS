"use server";

import { revalidatePath } from "next/cache";
import { describeError, hasProfile } from "@/lib/ai";
import { generateCoverLetter, saveCoverLetterText } from "@/lib/cover-letter";
import { generateInterviewPrep } from "@/lib/interview-prep";
import { getJobWorkspace } from "@/lib/jobs";

export type GenerateState = { error: string } | { ok: true } | null;

function jobIdFrom(form: FormData): number {
  const n = Number(form.get("job_id"));
  if (!Number.isInteger(n) || n <= 0) throw new Error("Invalid job");
  return n;
}

// Shared checks and error handling for the two "generate" buttons.
async function runGenerator(form: FormData, generate: (ws: NonNullable<ReturnType<typeof getJobWorkspace>>) => Promise<void>) {
  const workspace = getJobWorkspace(jobIdFrom(form));
  if (!workspace) return { error: "This job no longer exists." };
  if (!hasProfile()) return { error: "Set up your profile first. Everything generated here is based on it." };
  try {
    await generate(workspace);
  } catch (err) {
    return { error: describeError(err) };
  }
  revalidatePath(`/jobs/${workspace.job.id}`);
  return { ok: true as const };
}

export async function createCoverLetter(_prev: GenerateState, form: FormData): Promise<GenerateState> {
  const guidance = String(form.get("guidance") ?? "").trim();
  return runGenerator(form, (ws) => generateCoverLetter(ws.job, ws.contacts, guidance));
}

export async function saveCoverLetter(form: FormData) {
  const jobId = jobIdFrom(form);
  saveCoverLetterText(jobId, String(form.get("content") ?? "").trim());
  revalidatePath(`/jobs/${jobId}`);
}

export async function createInterviewPrep(_prev: GenerateState, form: FormData): Promise<GenerateState> {
  return runGenerator(form, async (ws) => {
    if (!ws.job.description) throw new Error("Save the job posting text first. Interview prep is built from it.");
    await generateInterviewPrep(ws.job);
  });
}
