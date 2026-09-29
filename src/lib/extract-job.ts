import "server-only";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { BASE_PARAMS, claude } from "./ai";
import type { ImportedJob } from "./import-job";

// Long enough for any real posting, with the page clutter around it.
export const MAX_PASTE_CHARS = 60_000;

// "" means none of the user's types fits.
function buildSchema(typeNames: string[]) {
  return z.object({
    company: z.string().describe("The hiring company's name. Empty string if it isn't in the text."),
    title: z.string().describe("The job title"),
    location: z.string().describe("Location(s) and work arrangement if stated, e.g. 'Vancouver, BC (hybrid)'. Empty if not stated."),
    description: z
      .string()
      .describe("The full job posting, copied word for word, with blank lines between sections and '• ' for list items"),
    type: z
      .enum(["", ...typeNames] as [string, ...string[]])
      .describe("Which of the user's job types this posting best fits, judged by its industry and role. Empty string if none clearly fits."),
  });
}

const INSTRUCTIONS = `The text below was copied from a web page showing a job posting (for example with Ctrl+A, Ctrl+C), so it includes page clutter around the posting.

Pull out the posting itself:
- Copy the posting's wording exactly. Don't summarize, shorten, rephrase or add anything.
- Leave out everything that isn't part of this posting: site menus, buttons ("Apply", "Save", "Share"), cookie notices, sign-in prompts, "similar jobs" or other listings, and footers.
- Keep the posting's own sections (about the company, responsibilities, qualifications, salary, benefits and so on) and its lists.
- If a field isn't in the text, leave it empty rather than guessing.

<copied_page>
`;

export async function extractJobFromText(pasted: string, typeNames: string[]): Promise<ImportedJob> {
  const response = await claude().beta.messages.parse({
    ...BASE_PARAMS,
    max_tokens: 16000,
    output_config: { effort: "low", format: betaZodOutputFormat(buildSchema(typeNames)) },
    messages: [{ role: "user", content: `${INSTRUCTIONS}${pasted.slice(0, MAX_PASTE_CHARS)}\n</copied_page>` }],
  });

  if (response.stop_reason === "refusal") throw new Error("Claude couldn't read that text.");
  if (response.stop_reason === "max_tokens") throw new Error("That posting is too long to sort automatically.");
  const job = response.parsed_output;
  if (!job) throw new Error("Claude's response couldn't be read.");
  const { type, ...fields } = job;
  return { ...fields, source: "", suggestedType: type || undefined };
}
