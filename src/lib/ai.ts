import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getProfile, listItems } from "./profile";
import { SECTIONS } from "./profile-sections";

// One place to change the model CareerOS uses. Sonnet balances cost and accuracy.
export const MODEL = "claude-sonnet-5";

// Shared request settings. Each call also sets an effort level: higher means more careful
// (and slightly more expensive) answers.
export const BASE_PARAMS = { model: MODEL, thinking: { type: "adaptive" as const } };

// Cover letters go to employers, so they use Opus, which sticks to the profile most reliably.
// If Opus's safety checks ever wrongly decline a request, the API retries on a fallback model.
export const COVER_LETTER_PARAMS = {
  model: "claude-opus-5",
  thinking: { type: "adaptive" as const },
  betas: ["server-side-fallback-2026-07-01"] satisfies Anthropic.Beta.AnthropicBeta[],
  fallbacks: "default" as const,
};

export function claude() {
  return new Anthropic(); // reads ANTHROPIC_API_KEY from .env.local
}

// The rule every feature shares: never invent experience.
export const HONESTY_RULES = `Ground rules:
- The candidate profile below is the only source of truth about the candidate. Never state or imply experience, skills, tools, results or credentials that are not in it.
- If something a posting asks for is not in the profile, say so plainly (e.g. "ANSYS does not appear in your profile") rather than writing around it.
- Transferable experience may be pointed out, but always name the actual experience it transfers from.
- Don't add details a profile entry doesn't state. In particular, don't connect a tool to a task unless the profile does (a listed skill doesn't mean it was used in a particular job), don't add audiences such as "clients" or outcomes it doesn't mention, and don't assume how quickly something was learned.`;

/** Render the profile as plain text for use in prompts. */
export function profileAsText(): string {
  const profile = getProfile();
  const items = listItems();
  const lines: string[] = [];

  if (profile?.name) lines.push(`Name: ${profile.name}`);
  if (profile?.headline) lines.push(`Headline: ${profile.headline}`);
  if (profile?.location) lines.push(`Location: ${profile.location}`);

  for (const section of SECTIONS) {
    const entries = items.filter((i) => i.section === section.id);
    if (entries.length === 0) continue;
    lines.push("", `## ${section.label}`);
    if (section.id === "skill") {
      lines.push(entries.map((s) => (s.subtitle ? `${s.title} (${s.subtitle})` : s.title)).join(", "));
      continue;
    }
    for (const e of entries) {
      lines.push(`- ${[e.title, e.subtitle, e.dates].filter(Boolean).join(" | ")}`);
      for (const detail of e.details.split("\n").filter(Boolean)) lines.push(`    ${detail}`);
    }
  }
  return lines.join("\n").trim();
}

export function hasProfile(): boolean {
  return listItems().length > 0;
}

/** Turn an API failure into a message the user can act on. */
export function describeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) {
    return "Your API key wasn't accepted. Check ANTHROPIC_API_KEY in .env.local.";
  }
  if (err instanceof Anthropic.APIError && err.status === 400 && /credit/i.test(err.message)) {
    return "Your Anthropic account is out of credit. Add some in the Claude Console.";
  }
  if (err instanceof Anthropic.RateLimitError || (err instanceof Anthropic.APIError && err.status === 529)) {
    return "Claude is busy right now. Try again in a minute.";
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return "Couldn't reach Claude. Check your internet connection and try again.";
  }
  console.error("Claude request failed:", err);
  return err instanceof Error ? err.message : "Something went wrong talking to Claude.";
}
