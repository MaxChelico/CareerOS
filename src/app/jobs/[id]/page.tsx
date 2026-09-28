import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteJobButton, StatusSelect } from "@/components/JobControls";
import { getJobWorkspace, listResumeVersions } from "@/lib/jobs";
import { CoverLetterTab } from "./cover-letter-tab";
import { InterviewTab } from "./interview-tab";
import {
  ContactsSection,
  DetailsSection,
  DocumentsSection,
  InterviewsSection,
  NotesSection,
  PostingSection,
  TasksSection,
} from "./sections";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "cover-letter", label: "Cover letter" },
  { id: "interview", label: "Interview prep" },
] as const;

export default async function JobPage({ params, searchParams }: PageProps<"/jobs/[id]">) {
  const { id } = await params;
  const { tab: tabParam } = await searchParams;
  const tab = TABS.find((t) => t.id === tabParam)?.id ?? "overview";

  const workspace = getJobWorkspace(Number(id));
  if (!workspace) notFound();
  const { job, contacts, interviews, tasks, documents } = workspace;
  const interviewing = job.status === "screening" || job.status === "interview";

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-6">
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">
        ← Board
      </Link>

      <div className="mt-3 flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{job.company}</h1>
          <p className="mt-0.5 text-slate-600">
            {job.title}
            {job.location && <span className="text-slate-400"> · {job.location}</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {job.url && (
            <a href={job.url} target="_blank" rel="noreferrer" className="btn-secondary">
              View posting ↗
            </a>
          )}
          <StatusSelect key={job.status} jobId={job.id} status={job.status} />
        </div>
      </div>

      <nav className="mt-5 mb-5 flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={t.id === "overview" ? `/jobs/${job.id}` : `/jobs/${job.id}?tab=${t.id}`}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t.id ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            {t.label}
            {t.id === "interview" && interviewing && tab !== "interview" && (
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" title="You're interviewing for this job" />
            )}
          </Link>
        ))}
      </nav>

      {tab === "cover-letter" && <CoverLetterTab job={job} />}
      {tab === "interview" && <InterviewTab job={job} />}
      {tab === "overview" && (
        <>
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="space-y-5 lg:col-span-2">
              <DetailsSection job={job} resumeVersions={listResumeVersions()} />
              <NotesSection job={job} />
              <PostingSection job={job} />
            </div>
            <div className="space-y-5">
              <TasksSection jobId={job.id} tasks={tasks} />
              <InterviewsSection jobId={job.id} interviews={interviews} />
              <ContactsSection jobId={job.id} contacts={contacts} />
              <DocumentsSection jobId={job.id} documents={documents} />
            </div>
          </div>

          <div className="mt-8 flex justify-end border-t border-slate-200 pt-4">
            <DeleteJobButton jobId={job.id} company={job.company} />
          </div>
        </>
      )}
    </div>
  );
}
