import { CoverLetterEditor } from "@/components/CoverLetterEditor";
import { GenerateForm } from "@/components/GenerateForm";
import { getCoverLetter } from "@/lib/cover-letter";
import { formatDate } from "@/lib/dates";
import type { Job } from "@/lib/jobs";
import { createCoverLetter } from "./ai-actions";

const GUIDANCE_PLACEHOLDER = "Optional: anything to emphasize or avoid, e.g. 'Focus on my structural analysis work'";

export function CoverLetterTab({ job }: { job: Job }) {
  const letter = getCoverLetter(job.id);

  if (!letter) {
    return (
      <div className="max-w-xl rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Write a cover letter for {job.company}</h2>
        <p className="mt-1 mb-4 text-sm text-slate-600">
          CareerOS drafts a letter from your profile and this posting. It only uses experience that&apos;s in your
          profile, and lists anything the posting asks for that your profile doesn&apos;t cover.
        </p>
        <GenerateForm
          action={createCoverLetter}
          jobId={job.id}
          label="Write cover letter"
          pendingLabel="Writing…"
          cost="about 5–10¢"
          guidance={{ placeholder: GUIDANCE_PLACEHOLDER }}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <section className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-2">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Cover letter</h2>
          <span className="text-xs text-slate-400">Drafted {formatDate(letter.created_at)}</span>
        </div>
        <CoverLetterEditor key={letter.created_at} jobId={job.id} content={letter.content} />
      </section>

      <div className="space-y-5">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Not in your profile</h2>
          {letter.missing.length === 0 ? (
            <p className="text-sm text-slate-500">Your profile covers everything notable in this posting.</p>
          ) : (
            <>
              <p className="mb-3 text-xs text-slate-500">
                The letter doesn&apos;t claim these. If you do have this experience, add it to your profile and
                redraft.
              </p>
              <ul className="space-y-2">
                {letter.missing.map((m) => (
                  <li key={m.requirement} className="text-sm">
                    <span className="mr-1.5 text-rose-500">✕</span>
                    <span className="font-medium">{m.requirement}</span>
                    <p className="ml-5 text-slate-600">{m.note}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Redraft</h2>
          <p className="mb-3 text-xs text-slate-500">Replaces the letter above, including any edits.</p>
          <GenerateForm
            action={createCoverLetter}
            jobId={job.id}
            label="Write a new draft"
            pendingLabel="Writing…"
            cost="about 5–10¢"
            variant="secondary"
            guidance={{ placeholder: GUIDANCE_PLACEHOLDER, defaultValue: letter.guidance }}
          />
        </section>
      </div>
    </div>
  );
}
