import "server-only";
import { db } from "./db";
import type { StageId } from "./stages";

// How far along the pipeline each positive stage is. Closed stages (rejected, ghosted,
// withdrawn) aren't progress, so they don't have a rank.
const RANK: Partial<Record<StageId, number>> = { saved: 0, applied: 1, screening: 2, interview: 3, offer: 4 };
const RESPONSE_STATUSES = new Set<string>(["screening", "interview", "offer", "rejected"]);

type JobRow = { id: number; status: StageId; source: string; resume_version: string; applied_at: string | null };
type EventRow = { job_id: number; status: string; changed_at: string };

// One application, summarized from its status history.
type Outcome = {
  source: string;
  resumeVersion: string;
  appliedAt: string;
  status: StageId;
  furthest: number; // highest RANK ever reached
  responded: boolean;
  daysToResponse: number | null;
};

export type Group = { label: string; applications: number; responses: number; interviews: number; offers: number };

export type Analytics = {
  applications: number;
  responses: number;
  screenings: number;
  interviews: number;
  offers: number;
  awaiting: number; // applied, no reply yet
  active: number; // currently in screening or interview
  closed: { rejected: number; ghosted: number; withdrawn: number };
  medianDaysToResponse: number | null;
  weekly: { weekStart: string; count: number }[];
  bySource: Group[];
  byResume: Group[];
};

const DAY = 86_400_000;
const toDate = (s: string) => new Date(s.length === 10 ? `${s}T00:00` : s);

function outcomes(): Outcome[] {
  const jobs = db
    .prepare("SELECT id, status, source, resume_version, applied_at FROM jobs WHERE applied_at IS NOT NULL")
    .all() as JobRow[];
  const events = db.prepare("SELECT job_id, status, changed_at FROM status_events ORDER BY changed_at, id").all() as EventRow[];

  return jobs.map((job) => {
    const history = events.filter((e) => e.job_id === job.id);
    const statuses = [...history.map((e) => e.status), job.status];
    const firstResponse = history.find((e) => RESPONSE_STATUSES.has(e.status));
    return {
      source: job.source || "Not recorded",
      resumeVersion: job.resume_version || "Not recorded",
      appliedAt: job.applied_at!,
      status: job.status,
      furthest: Math.max(...statuses.map((s) => RANK[s as StageId] ?? 0)),
      responded: statuses.some((s) => RESPONSE_STATUSES.has(s)),
      daysToResponse: firstResponse
        ? Math.max(0, Math.round((toDate(firstResponse.changed_at).getTime() - toDate(job.applied_at!).getTime()) / DAY))
        : null,
    };
  });
}

function groupBy(list: Outcome[], key: (o: Outcome) => string): Group[] {
  const groups = new Map<string, Outcome[]>();
  for (const o of list) groups.set(key(o), [...(groups.get(key(o)) ?? []), o]);
  return [...groups]
    .map(([label, items]) => ({
      label,
      applications: items.length,
      responses: items.filter((o) => o.responded).length,
      interviews: items.filter((o) => o.furthest >= RANK.interview!).length,
      offers: items.filter((o) => o.furthest >= RANK.offer!).length,
    }))
    .sort((a, b) => b.applications - a.applications);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

// Monday of the week containing the date, as YYYY-MM-DD (local time).
function weekStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function weekly(list: Outcome[], weeks = 12) {
  const thisWeek = weekStart(new Date());
  return Array.from({ length: weeks }, (_, i) => {
    const start = new Date(thisWeek);
    start.setDate(start.getDate() - (weeks - 1 - i) * 7);
    const key = isoDay(start);
    return { weekStart: key, count: list.filter((o) => isoDay(weekStart(toDate(o.appliedAt))) === key).length };
  });
}

export function getAnalytics(): Analytics {
  const list = outcomes();
  const count = (test: (o: Outcome) => boolean) => list.filter(test).length;

  return {
    applications: list.length,
    responses: count((o) => o.responded),
    screenings: count((o) => o.furthest >= RANK.screening!),
    interviews: count((o) => o.furthest >= RANK.interview!),
    offers: count((o) => o.furthest >= RANK.offer!),
    awaiting: count((o) => o.status === "applied"),
    active: count((o) => o.status === "screening" || o.status === "interview"),
    closed: {
      rejected: count((o) => o.status === "rejected"),
      ghosted: count((o) => o.status === "ghosted"),
      withdrawn: count((o) => o.status === "withdrawn"),
    },
    medianDaysToResponse: median(list.flatMap((o) => (o.daysToResponse === null ? [] : [o.daysToResponse]))),
    weekly: weekly(list),
    bySource: groupBy(list, (o) => o.source),
    byResume: groupBy(list, (o) => o.resumeVersion),
  };
}
