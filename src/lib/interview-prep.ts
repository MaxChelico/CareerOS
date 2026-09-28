import "server-only";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { BASE_PARAMS, claude, HONESTY_RULES, profileAsText } from "./ai";
import { db } from "./db";
import { now } from "./dates";
import type { Job } from "./jobs";
import { listItems } from "./profile";

export type InterviewPrep = {
  focus_areas: { area: string; why: string; posting_quotes: string[] }[];
  questions: { question: string; category: string; experience: string[]; tip: string }[];
  gaps: { requirement: string; note: string; prepare: string }[];
  research: string[];
  created_at: string;
};

export function getInterviewPrep(jobId: number): InterviewPrep | undefined {
  const row = db.prepare("SELECT data, created_at FROM interview_preps WHERE job_id = ?").get(jobId) as
    | { data: string; created_at: string }
    | undefined;
  return row && { ...JSON.parse(row.data), created_at: row.created_at };
}

function buildSchema(experienceTitles: string[]) {
  // Questions can only point at experience that exists: the model picks from the real entry titles.
  // (Features that use this require a profile, so the list is never empty in practice.)
  const experience = experienceTitles.length
    ? z.array(z.enum(experienceTitles as [string, ...string[]]))
    : z.array(z.string());

  return z.object({
    focus_areas: z
      .array(
        z.object({
          area: z.string().describe("Short name, 1-4 words, e.g. 'Building codes' or 'Teamwork'"),
          why: z.string().describe("One sentence on why, based on the posting"),
          posting_quotes: z
            .array(z.string())
            .describe("Short phrases copied exactly, character for character, from the posting that point to this area"),
        }),
      )
      .describe("4-7 areas, most emphasized first"),
    questions: z
      .array(
        z.object({
          question: z.string(),
          category: z.enum(["Technical", "Behavioural", "Role & company"]),
          experience: experience.describe("Profile entries the candidate could draw on in their answer. Empty if none fit."),
          tip: z.string().describe("One or two sentences on how to answer, naming specifics from the profile"),
        }),
      )
      .describe("8-12 likely questions across all three categories"),
    gaps: z
      .array(
        z.object({
          requirement: z.string(),
          note: z.string().describe("Plainly what's missing, e.g. 'Posting mentions Siemens NX; your profile lists SolidWorks.'"),
          prepare: z.string().describe("How to prepare to discuss it honestly"),
        }),
      )
      .describe("Requirements the profile doesn't cover that may come up"),
    research: z
      .array(z.string())
      .describe("4-6 specific things to look up about the company or team before the interview. Suggestions to research, not claims about the company."),
  });
}

// Loose matching so curly quotes, dashes and line breaks don't cause false rejections.
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[•\s]+/g, " ")
    .trim();
}

export async function generateInterviewPrep(job: Job) {
  const titles = [...new Set(listItems().filter((i) => i.section !== "skill").map((i) => i.title))];

  const prompt = `Prepare this candidate for an interview for the job below.

${HONESTY_RULES}
- Base likely topics on what the posting actually emphasizes. Don't invent facts about the company; anything you're unsure of belongs in "research" as something to look up.

<job>
Company: ${job.company}
Title: ${job.title}

${job.description}
</job>

<candidate_profile>
${profileAsText()}
</candidate_profile>`;

  const response = await claude().beta.messages.parse({
    ...BASE_PARAMS,
    max_tokens: 16000,
    output_config: { effort: "medium", format: betaZodOutputFormat(buildSchema(titles)) },
    messages: [{ role: "user", content: prompt }],
  });

  if (response.stop_reason === "refusal") throw new Error("Claude declined to prepare this.");
  const prep = response.parsed_output;
  if (!prep) throw new Error("Claude's response couldn't be read.");

  // Keep only quotes that really appear in the posting, and areas that still have evidence.
  const posting = normalize(job.description);
  const focus_areas = prep.focus_areas
    .map((a) => ({ ...a, posting_quotes: a.posting_quotes.filter((q) => q && posting.includes(normalize(q))) }))
    .filter((a) => a.posting_quotes.length > 0);

  const data = { ...prep, focus_areas };
  db.prepare(
    `INSERT INTO interview_preps (job_id, data, created_at) VALUES (?, ?, ?)
     ON CONFLICT (job_id) DO UPDATE SET data = excluded.data, created_at = excluded.created_at`,
  ).run(job.id, JSON.stringify(data), now());
}
