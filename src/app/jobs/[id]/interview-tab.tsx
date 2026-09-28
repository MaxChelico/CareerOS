import { Chat } from "@/components/Chat";
import { GenerateForm } from "@/components/GenerateForm";
import { listMessages } from "@/lib/chat";
import { formatDate } from "@/lib/dates";
import { getInterviewPrep, type InterviewPrep } from "@/lib/interview-prep";
import type { Job } from "@/lib/jobs";
import { createInterviewPrep } from "./ai-actions";

export function InterviewTab({ job }: { job: Job }) {
  const prep = getInterviewPrep(job.id);
  const thread = `interview-${job.id}`;

  return (
    <div className="grid items-start gap-5 lg:grid-cols-5">
      <div className="space-y-5 lg:col-span-3">
        {prep ? (
          <PrepView jobId={job.id} prep={prep} />
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">Prepare for your {job.company} interview</h2>
            <p className="mt-1 mb-4 text-sm text-slate-600">
              CareerOS reads the posting and your profile to work out what&apos;s likely to come up, which of your
              experiences fit each question, and where the gaps are.
            </p>
            <GenerateForm action={createInterviewPrep} jobId={job.id} label="Prepare for interview" pendingLabel="Preparing…" cost="about 2–4¢" />
          </div>
        )}
      </div>

      <div className="lg:sticky lg:top-4 lg:col-span-2 lg:h-[calc(100vh-2rem)]">
        <Chat
          thread={thread}
          initialMessages={listMessages(thread)}
          title="Practice interview"
          intro={`A mock interviewer from ${job.company} asks you one question at a time and gives feedback on each answer.`}
          placeholder="Type your answer…"
          starters={["I'm ready, start the interview.", "Start with behavioural questions only."]}
        />
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">{title}</h2>
      {children}
    </section>
  );
}

function PrepView({ jobId, prep }: { jobId: number; prep: InterviewPrep }) {
  const maxQuotes = Math.max(1, ...prep.focus_areas.map((a) => a.posting_quotes.length));
  const categories = [...new Set(prep.questions.map((q) => q.category))];

  return (
    <>
      <Card title="Likely focus areas">
        <p className="-mt-1 mb-3 text-xs text-slate-500">
          Bar length is how often the posting points to each area. Click one to see the exact wording.
        </p>
        <div className="space-y-2">
          {prep.focus_areas.map((a) => (
            <details key={a.area} className="group">
              <summary className="flex cursor-pointer list-none items-center gap-3">
                <span className="w-40 shrink-0 text-sm font-medium">{a.area}</span>
                <span className="h-2.5 flex-1 rounded-full bg-slate-100">
                  <span
                    className="block h-full rounded-full bg-sky-500"
                    style={{ width: `${(a.posting_quotes.length / maxQuotes) * 100}%` }}
                  />
                </span>
                <span className="w-20 shrink-0 text-right text-xs text-slate-500">
                  {a.posting_quotes.length} {a.posting_quotes.length === 1 ? "mention" : "mentions"}
                </span>
              </summary>
              <div className="mt-2 mb-3 ml-43 space-y-1 text-sm">
                <p className="text-slate-600">{a.why}</p>
                {a.posting_quotes.map((q) => (
                  <p key={q} className="border-l-2 border-sky-200 pl-2 text-slate-500 italic">
                    “{q}”
                  </p>
                ))}
              </div>
            </details>
          ))}
        </div>
      </Card>

      <Card title="Likely questions">
        <div className="space-y-5">
          {categories.map((category) => (
            <div key={category}>
              <p className="mb-2 text-xs font-medium text-slate-500">{category}</p>
              <ul className="space-y-3">
                {prep.questions
                  .filter((q) => q.category === category)
                  .map((q) => (
                    <li key={q.question} className="rounded-lg bg-slate-50 p-3">
                      <p className="text-sm font-medium">{q.question}</p>
                      {q.experience.length > 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="text-xs text-slate-500">Draw on:</span>
                          {q.experience.map((e) => (
                            <span key={e} className="rounded bg-white px-1.5 py-0.5 text-xs text-slate-700 ring-1 ring-slate-200">
                              {e}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="mt-1.5 text-sm text-slate-600">{q.tip}</p>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      {prep.gaps.length > 0 && (
        <Card title="Potential weak spots">
          <ul className="space-y-3">
            {prep.gaps.map((g) => (
              <li key={g.requirement} className="text-sm">
                <p className="font-medium">
                  <span className="mr-1.5 text-amber-500">△</span>
                  {g.requirement}
                </p>
                <p className="ml-5 text-slate-600">{g.note}</p>
                <p className="mt-1 ml-5 text-slate-600">
                  <span className="font-medium text-slate-700">Prepare: </span>
                  {g.prepare}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Research before the interview">
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          {prep.research.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </Card>

      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">Prepared {formatDate(prep.created_at)}</span>
        <GenerateForm action={createInterviewPrep} jobId={jobId} label="Redo prep" pendingLabel="Preparing…" cost="about 2–4¢" variant="secondary" />
      </div>
    </>
  );
}
