import Link from "next/link";
import { getAnalytics, type Group } from "@/lib/analytics";
import { formatDate } from "@/lib/dates";

// Rates from fewer applications than this are shown but flagged as unreliable.
const MIN_SAMPLE = 5;

const pct = (part: number, whole: number) => (whole ? `${((part / whole) * 100).toFixed(1)}%` : "–");

export default function AnalyticsPage() {
  const a = getAnalytics();

  if (a.applications === 0) {
    return (
      <div className="m-auto max-w-sm px-6 text-center">
        <h1 className="text-lg font-semibold">No applications yet</h1>
        <p className="mt-2 text-sm text-slate-600">
          Analytics start once you move a job to Applied (or add one as already applied). Saved jobs don&apos;t count.
        </p>
        <Link href="/" className="btn-secondary mt-5">
          Go to the board
        </Link>
      </div>
    );
  }

  const funnel = [
    { label: "Applied", value: a.applications },
    { label: "Screening", value: a.screenings },
    { label: "Interview", value: a.interviews },
    { label: "Offer", value: a.offers },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-6 py-6">
      <h1 className="text-lg font-semibold">Your job search</h1>

      {/* Headline numbers */}
      <div className="grid gap-4 md:grid-cols-[1.2fr_2fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Response rate</p>
          <p className="mt-1 text-5xl font-semibold tracking-tight">{pct(a.responses, a.applications)}</p>
          <p className="mt-2 text-sm text-slate-600">
            {a.responses} of {a.applications} applications got a reply. Rejections count as replies; ghosted
            applications don&apos;t.
          </p>
          {a.applications < MIN_SAMPLE && <SmallSampleNote />}
        </section>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat label="Applications" value={a.applications} />
          <Stat label="Responses" value={a.responses} />
          <Stat label="Screenings" value={a.screenings} />
          <Stat label="Interviews" value={a.interviews} />
          <Stat label="Offers" value={a.offers} />
          <Stat
            label="Typical wait for a reply"
            value={a.medianDaysToResponse === null ? "–" : `${a.medianDaysToResponse} days`}
            note={a.medianDaysToResponse === null ? "No replies yet" : "Median, applied to first reply"}
          />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="How far applications get">
          <Funnel steps={funnel} />
        </Card>
        <Card title="Where things stand now">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <Row label="Waiting to hear back" value={a.awaiting} />
            <Row label="In progress (screening or interview)" value={a.active} />
            <Row label="Rejected" value={a.closed.rejected} />
            <Row label="Ghosted" value={a.closed.ghosted} />
            <Row label="Withdrawn" value={a.closed.withdrawn} />
            <Row label="Offers" value={a.offers} />
          </dl>
          <p className="mt-4 text-xs text-slate-500">
            Tip: move applications with no reply after a few weeks to Ghosted so they stop counting as waiting.
          </p>
        </Card>
      </div>

      <Card title="Applications per week">
        <WeeklyColumns weeks={a.weekly} />
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="By where you found the job">
          <GroupTable groups={a.bySource} dimension="Source" />
        </Card>
        <Card title="By resume version">
          <GroupTable groups={a.byResume} dimension="Resume" />
        </Card>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-4 text-xs font-semibold tracking-wide text-slate-500 uppercase">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ label, value, note }: { label: string; value: number | string; note?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {note && <p className="mt-0.5 text-xs text-slate-400">{note}</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between border-b border-slate-100 pb-2">
      <dt className="text-slate-600">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function SmallSampleNote() {
  return (
    <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
      Based on fewer than {MIN_SAMPLE} applications, so this will swing a lot as you apply to more.
    </p>
  );
}

// Hover (or keyboard focus) reveals the exact numbers for a mark.
function Tooltip({ children }: { children: React.ReactNode }) {
  return (
    <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 rounded-md bg-slate-900 px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-lg group-hover:block group-focus:block">
      {children}
    </span>
  );
}

function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const max = Math.max(1, steps[0].value);
  return (
    <div className="space-y-3">
      {steps.map((step, i) => {
        const prev = i > 0 ? steps[i - 1].value : null;
        return (
          <div key={step.label} className="grid grid-cols-[5.5rem_1fr_7rem] items-center gap-3 text-sm">
            <span className="text-slate-600">{step.label}</span>
            <span className="group relative flex h-6 items-center outline-none" tabIndex={0}>
              {step.value > 0 && (
                <span
                  className="h-full rounded-r bg-sky-600"
                  style={{ width: `${(step.value / max) * 100}%`, minWidth: 4 }}
                />
              )}
              <span className="ml-2 font-semibold tabular-nums">{step.value}</span>
              <Tooltip>
                {step.label}: {step.value} of {max} applications ({pct(step.value, max)})
              </Tooltip>
            </span>
            <span className="text-right text-xs text-slate-500">
              {prev === null ? "" : `${pct(step.value, prev)} of ${steps[i - 1].label.toLowerCase()}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function WeeklyColumns({ weeks }: { weeks: { weekStart: string; count: number }[] }) {
  const max = Math.max(1, ...weeks.map((w) => w.count));
  return (
    <div>
      <div className="flex h-40 items-end gap-2 border-b border-slate-200">
        {weeks.map((w) => (
          <div key={w.weekStart} className="group relative flex h-full flex-1 items-end justify-center outline-none" tabIndex={0}>
            {w.count > 0 && (
              <span className="w-full max-w-6 rounded-t bg-sky-600" style={{ height: `${(w.count / max) * 100}%` }} />
            )}
            <Tooltip>
              Week of {formatDate(w.weekStart)}: {w.count} {w.count === 1 ? "application" : "applications"}
            </Tooltip>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2 text-[11px] text-slate-400">
        {weeks.map((w, i) => (
          <span key={w.weekStart} className="flex-1 text-center">
            {i % 2 === 0 || i === weeks.length - 1 ? formatDate(w.weekStart) : ""}
          </span>
        ))}
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-900">Show as table</summary>
        <table className="mt-2 w-full max-w-xs text-sm">
          <tbody>
            {weeks.map((w) => (
              <tr key={w.weekStart} className="border-b border-slate-100">
                <td className="py-1 text-slate-600">Week of {formatDate(w.weekStart)}</td>
                <td className="py-1 text-right tabular-nums">{w.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

function GroupTable({ groups, dimension }: { groups: Group[]; dimension: string }) {
  return (
    <>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
            <th className="pb-2 font-medium">{dimension}</th>
            <th className="pb-2 text-right font-medium">Applied</th>
            <th className="pb-2 text-right font-medium">Replies</th>
            <th className="pb-2 text-right font-medium">Interviews</th>
            <th className="pb-2 text-right font-medium">Reply rate</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.label} className="border-b border-slate-100">
              <td className={`py-2 ${g.label === "Not recorded" ? "text-slate-400 italic" : ""}`}>{g.label}</td>
              <td className="py-2 text-right tabular-nums">{g.applications}</td>
              <td className="py-2 text-right tabular-nums">{g.responses}</td>
              <td className="py-2 text-right tabular-nums">{g.interviews}</td>
              <td className="py-2 text-right tabular-nums">
                {g.applications < MIN_SAMPLE ? (
                  <span className="text-slate-400" title={`Fewer than ${MIN_SAMPLE} applications`}>
                    {pct(g.responses, g.applications)}*
                  </span>
                ) : (
                  <span className="font-semibold">{pct(g.responses, g.applications)}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {groups.some((g) => g.applications < MIN_SAMPLE) && (
        <p className="mt-3 text-xs text-slate-500">
          * Fewer than {MIN_SAMPLE} applications, too few to compare fairly yet.
        </p>
      )}
    </>
  );
}
