import "server-only";
import { HONESTY_RULES, profileAsText } from "./ai";
import { db } from "./db";
import { now } from "./dates";
import { getJob } from "./jobs";

export type ChatMessage = { id: number; role: "user" | "assistant"; content: string };

// 'profile' is the resume coach; 'interview-<job id>' is a practice interview for that job.
export function parseThread(thread: unknown): { kind: "profile" } | { kind: "interview"; jobId: number } | null {
  if (thread === "profile") return { kind: "profile" };
  const match = typeof thread === "string" && /^interview-(\d+)$/.exec(thread);
  return match ? { kind: "interview", jobId: Number(match[1]) } : null;
}

export function listMessages(thread: string): ChatMessage[] {
  return db
    .prepare("SELECT id, role, content FROM chat_messages WHERE thread = ? ORDER BY id")
    .all(thread) as ChatMessage[];
}

export function addMessage(thread: string, role: ChatMessage["role"], content: string): number {
  const { lastInsertRowid } = db
    .prepare("INSERT INTO chat_messages (thread, role, content, created_at) VALUES (?, ?, ?, ?)")
    .run(thread, role, content, now());
  return Number(lastInsertRowid);
}

export function deleteMessage(id: number) {
  db.prepare("DELETE FROM chat_messages WHERE id = ?").run(id);
}

export function clearThread(thread: string) {
  db.prepare("DELETE FROM chat_messages WHERE thread = ?").run(thread);
}

/** Instructions for each kind of chat. Returns undefined if the thread's job no longer exists. */
export function systemPrompt(thread: string): string | undefined {
  const parsed = parseThread(thread);
  if (!parsed) return undefined;
  const profile = `<candidate_profile>\n${profileAsText() || "(The profile is empty.)"}\n</candidate_profile>`;

  if (parsed.kind === "profile") {
    return `You are a candid, practical career coach helping an engineering student improve their resume and plan their job search. You're chatting inside CareerOS, their personal job-search app.

${HONESTY_RULES}
- When suggesting rewrites of resume lines, keep them true to the profile. If a stronger bullet would need information you don't have (a number, a result, a tool), ask for it rather than making it up.
- Be concise. Use short paragraphs or lists; this is a chat, not a report.

${profile}`;
  }

  const job = getJob(parsed.jobId);
  if (!job) return undefined;
  return `You are running a practice interview for the candidate below, as an interviewer from ${job.company} hiring for "${job.title}".

How the session works:
- Ask one question at a time, then wait for the answer. Mix technical questions drawn from the posting with behavioural ones.
- After each answer, give brief feedback before the next question: one thing that worked, one thing to improve, and where relevant a specific experience from their profile they could have used. Put the feedback first, then the next question on its own line starting with "Next question:".
- If an answer claims experience that isn't in the profile, point it out gently: they may simply not have added it yet, but in a real interview it needs to be backed up.
- After about six questions, or whenever the candidate asks, finish with a short overall summary: strengths, the top two things to practise, and how ready they seem.
- Stay in character as a professional, friendly interviewer. Keep your messages short.

${HONESTY_RULES}

<job>
${job.description || "(No posting text saved; base questions on the job title.)"}
</job>

${profile}`;
}
