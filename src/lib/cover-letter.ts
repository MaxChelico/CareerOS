import "server-only";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { claude, COVER_LETTER_PARAMS, HONESTY_RULES, profileAsText } from "./ai";
import { db } from "./db";
import { now } from "./dates";
import type { Contact, Job } from "./jobs";

export type MissingRequirement = { requirement: string; note: string };

export type CoverLetter = {
  job_id: number;
  content: string;
  missing: MissingRequirement[];
  guidance: string;
  created_at: string;
};

const LetterSchema = z.object({
  letter: z.string().describe("The full cover letter, from greeting to sign-off, as plain text with blank lines between paragraphs"),
  missing: z
    .array(
      z.object({
        requirement: z.string().describe("A skill, tool or qualification the posting asks for"),
        note: z.string().describe("One sentence, e.g. 'ANSYS does not appear in your profile.' Mention related experience only if it exists in the profile."),
      }),
    )
    .describe("Every notable requirement from the posting that the profile does not demonstrate"),
});

export function getCoverLetter(jobId: number): CoverLetter | undefined {
  const row = db.prepare("SELECT * FROM cover_letters WHERE job_id = ?").get(jobId) as
    | (Omit<CoverLetter, "missing"> & { missing: string })
    | undefined;
  return row && { ...row, missing: JSON.parse(row.missing) };
}

export function saveCoverLetterText(jobId: number, content: string) {
  db.prepare("UPDATE cover_letters SET content = ? WHERE job_id = ?").run(content, jobId);
}

export async function generateCoverLetter(job: Job, contacts: Contact[], guidance: string) {
  const recruiter = contacts.find((c) => /recruit|talent|hiring|hr/i.test(c.role)) ?? contacts[0];

  const prompt = `Write a cover letter for this job application.

${HONESTY_RULES}

Letter guidelines:
- About 250-350 words, three or four paragraphs. Professional, warm and direct; no clichés like "I am writing to express my interest".
- Pick the two or three profile experiences most relevant to this posting and be specific about them, using the facts and numbers the profile gives.
- Connect the experience to what the posting actually asks for. Do not paste the posting's language back verbatim.
- The letter is for the employer, so don't list the candidate's gaps in it; those go in "missing". A single brief line showing eagerness to learn the role's core area is fine.
- Address it to ${recruiter ? recruiter.name : "the hiring team (use 'Dear Hiring Team,')"}, and sign off with the candidate's name.
- Canadian spelling.
${guidance ? `\nThe candidate asked for this: ${guidance}\n` : ""}
<job>
Company: ${job.company}
Title: ${job.title}
Location: ${job.location || "not given"}

${job.description || "(No posting text saved. Write from the company and title only, and note in 'missing' that the posting text is missing.)"}
</job>

<candidate_profile>
${profileAsText()}
</candidate_profile>`;

  const response = await claude().beta.messages.parse({
    ...COVER_LETTER_PARAMS,
    max_tokens: 16000,
    output_config: { effort: "high", format: betaZodOutputFormat(LetterSchema) },
    messages: [{ role: "user", content: prompt }],
  });

  if (response.stop_reason === "refusal") throw new Error("Claude declined to write this letter.");
  const result = response.parsed_output;
  if (!result) throw new Error("Claude's response couldn't be read.");

  db.prepare(
    `INSERT INTO cover_letters (job_id, content, missing, guidance, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (job_id) DO UPDATE SET content = excluded.content, missing = excluded.missing,
       guidance = excluded.guidance, created_at = excluded.created_at`,
  ).run(job.id, result.letter.trim(), JSON.stringify(result.missing), guidance, now());
}
