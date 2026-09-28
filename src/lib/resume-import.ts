import "server-only";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { BASE_PARAMS, claude } from "./ai";
import type { ContactFields, ItemFields } from "./profile";

const Entry = z.object({
  title: z.string().describe("Degree, job title, or project name"),
  organization: z.string().describe("School, company, or lab. Empty string if none."),
  dates: z.string().describe("Dates exactly as written on the resume. Empty string if none."),
  bullets: z.array(z.string()).describe("Each bullet or description line, in the resume's own wording"),
});

const ResumeSchema = z.object({
  name: z.string(),
  headline: z.string().describe("A title line under the name, if the resume has one; otherwise empty"),
  email: z.string(),
  phone: z.string(),
  location: z.string(),
  links: z.array(z.string()).describe("LinkedIn, GitHub, portfolio or other URLs"),
  education: z.array(Entry),
  experience: z.array(Entry),
  projects: z.array(Entry),
  skills: z.array(
    z.object({
      name: z.string(),
      category: z.string().describe("The skills sub-heading it appears under, e.g. 'Software'. Empty if none."),
    }),
  ),
});

const INSTRUCTIONS = `Convert this resume into structured data.

This profile is the source of truth for everything CareerOS later says about the person, so accuracy matters more than polish:
- Copy wording faithfully. Do not rephrase, summarize, embellish, or add anything that is not on the page.
- Leave a field as an empty string (or an empty list) when the resume doesn't contain it. Never guess.
- Put anything under a projects heading in "projects", and paid or research positions in "experience". Coursework, awards, and similar lines belong in the bullets of the most relevant education entry.
- List every skill individually, keeping the resume's skill sub-headings as the category.`;

export type ParsedResume = { contact: ContactFields; items: ItemFields[] };

export async function parseResume(pdf: Buffer): Promise<ParsedResume> {
  const response = await claude().beta.messages.parse({
    ...BASE_PARAMS,
    max_tokens: 16000,
    output_config: { effort: "medium", format: betaZodOutputFormat(ResumeSchema) },
    messages: [
      {
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf.toString("base64") } },
          { type: "text", text: INSTRUCTIONS },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") throw new Error("Claude declined to read this file.");
  if (response.stop_reason === "max_tokens") throw new Error("The resume was too long to read in one pass.");
  const resume = response.parsed_output;
  if (!resume) throw new Error("Claude's response couldn't be read as a resume.");

  const entry = (section: ItemFields["section"]) => (e: z.infer<typeof Entry>) => ({
    section,
    title: e.title,
    subtitle: e.organization,
    dates: e.dates,
    details: e.bullets.join("\n"),
  });

  return {
    contact: {
      name: resume.name,
      headline: resume.headline,
      email: resume.email,
      phone: resume.phone,
      location: resume.location,
      links: resume.links.join("\n"),
    },
    items: [
      ...resume.education.map(entry("education")),
      ...resume.experience.map(entry("experience")),
      ...resume.projects.map(entry("project")),
      ...resume.skills.map((s) => ({ section: "skill" as const, title: s.name, subtitle: s.category, dates: "", details: "" })),
    ],
  };
}
