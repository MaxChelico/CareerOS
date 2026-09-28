// Pipeline stages, in board order. "closed" stages are hidden on the board by default.
export const STAGES = [
  { id: "saved", label: "Saved", dot: "bg-slate-400", closed: false },
  { id: "applied", label: "Applied", dot: "bg-sky-500", closed: false },
  { id: "screening", label: "Screening", dot: "bg-indigo-500", closed: false },
  { id: "interview", label: "Interview", dot: "bg-amber-500", closed: false },
  { id: "offer", label: "Offer", dot: "bg-emerald-500", closed: false },
  { id: "rejected", label: "Rejected", dot: "bg-rose-500", closed: true },
  { id: "ghosted", label: "Ghosted", dot: "bg-stone-400", closed: true },
  { id: "withdrawn", label: "Withdrawn", dot: "bg-stone-400", closed: true },
] as const;

export type StageId = (typeof STAGES)[number]["id"];

export function isStage(value: unknown): value is StageId {
  return STAGES.some((s) => s.id === value);
}

export function stageOf(id: string) {
  return STAGES.find((s) => s.id === id) ?? STAGES[0];
}

export const SOURCES = ["LinkedIn", "Company site", "Indeed", "Referral", "Job fair", "Other"];

export const DOCUMENT_KINDS = [
  { id: "resume", label: "Resume" },
  { id: "cover_letter", label: "Cover letter" },
  { id: "other", label: "Other" },
] as const;

// An application sitting in "Applied" this long without movement gets a follow-up nudge.
export const FOLLOW_UP_DAYS = 14;
