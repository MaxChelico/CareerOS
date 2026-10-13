import {
  addContact,
  addInterview,
  addTask,
  deleteDocument,
  deleteItem,
  saveJobText,
  toggleTask,
  updateJob,
  uploadDocument,
} from "@/app/actions";
import { JobTypeSelect } from "@/components/JobTypeBadge";
import { SubmitButton } from "@/components/SubmitButton";
import { formatDate, formatDateTime, today } from "@/lib/dates";
import type { ChildKind, Contact, Document, Interview, Job, Task } from "@/lib/jobs";
import { DOCUMENT_KINDS, SOURCES } from "@/lib/stages";
import type { JobType } from "@/lib/type-colors";

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
        {title}
        {count !== undefined && count > 0 && <span className="font-normal text-slate-400">{count}</span>}
      </h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function DeleteButton({ kind, id, label }: { kind: ChildKind; id: number; label: string }) {
  return (
    <form action={deleteItem}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <button type="submit" aria-label={`Remove ${label}`} className="px-1 text-slate-300 hover:text-rose-600">
        ×
      </button>
    </form>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-400">{children}</p>;
}

// ---------- Main column ----------

export function DetailsSection({ job, resumeVersions, types }: { job: Job; resumeVersions: string[]; types: JobType[] }) {
  return (
    <Section title="Application">
      <form action={updateJob} className="grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="id" value={job.id} />
        <Field label="Company">
          <input name="company" required defaultValue={job.company} className="field" />
        </Field>
        <Field label="Job title">
          <input name="title" required defaultValue={job.title} className="field" />
        </Field>
        <Field label="Location">
          <input name="location" defaultValue={job.location} className="field" />
        </Field>
        <Field label="Where you found it">
          <input name="source" list="sources" defaultValue={job.source} className="field" />
          <datalist id="sources">
            {SOURCES.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>
        <Field label="Type">
          <JobTypeSelect types={types} defaultValue={job.type_id} />
        </Field>
        <Field label="Date applied">
          <input name="applied_at" type="date" defaultValue={job.applied_at ?? ""} className="field" />
        </Field>
        <Field label="Resume version sent">
          <input
            name="resume_version"
            list="resume-versions"
            defaultValue={job.resume_version}
            placeholder="e.g. v4"
            className="field"
          />
          <datalist id="resume-versions">
            {resumeVersions.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Posting link">
            <div className="flex gap-2">
              <input name="url" type="url" defaultValue={job.url} className="field" />
              {job.url && (
                <a
                  href={job.url}
                  target="_blank"
                  rel="noreferrer"
                  title="Open the posting in a new tab"
                  className="btn-secondary shrink-0"
                >
                  Open ↗
                </a>
              )}
            </div>
          </Field>
        </div>
        <div className="flex justify-end sm:col-span-2">
          <SubmitButton variant="secondary" pendingText="Saving…">
            Save details
          </SubmitButton>
        </div>
      </form>
    </Section>
  );
}

export function NotesSection({ job }: { job: Job }) {
  return (
    <Section title="Notes">
      <form action={saveJobText} className="space-y-2">
        <input type="hidden" name="id" value={job.id} />
        <input type="hidden" name="field" value="notes" />
        <textarea
          name="value"
          rows={5}
          defaultValue={job.notes}
          placeholder="Teams you're interested in, what the recruiter said, anything worth remembering…"
          className="field leading-relaxed"
        />
        <div className="flex justify-end">
          <SubmitButton variant="secondary" pendingText="Saving…">
            Save notes
          </SubmitButton>
        </div>
      </form>
    </Section>
  );
}

export function PostingSection({ job }: { job: Job }) {
  const editor = (
    <form action={saveJobText} className="space-y-2">
      <input type="hidden" name="id" value={job.id} />
      <input type="hidden" name="field" value="description" />
      <textarea
        name="value"
        rows={12}
        defaultValue={job.description}
        placeholder="Paste the full job posting here."
        className="field font-mono text-xs leading-relaxed"
      />
      <div className="flex justify-end">
        <SubmitButton variant="secondary" pendingText="Saving…">
          Save posting
        </SubmitButton>
      </div>
    </form>
  );

  return (
    <Section title="Job posting">
      {job.description ? (
        <>
          <div className="max-h-96 overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap text-slate-700">
            {job.description}
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-900">Edit posting text</summary>
            <div className="mt-2">{editor}</div>
          </details>
        </>
      ) : (
        editor
      )}
    </Section>
  );
}

// ---------- Side column ----------

export function TasksSection({ jobId, tasks }: { jobId: number; tasks: Task[] }) {
  return (
    <Section title="Tasks" count={tasks.filter((t) => !t.done).length}>
      <ul className="space-y-1">
        {tasks.map((task) => (
          <li key={task.id} className="group flex items-start gap-2">
            <form action={toggleTask}>
              <input type="hidden" name="id" value={task.id} />
              <button
                type="submit"
                aria-label={task.done ? "Mark not done" : "Mark done"}
                className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded border text-[10px] ${
                  task.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 hover:border-slate-500"
                }`}
              >
                {task.done ? "✓" : ""}
              </button>
            </form>
            <span className={`flex-1 text-sm ${task.done ? "text-slate-400 line-through" : ""}`}>{task.text}</span>
            <DeleteButton kind="task" id={task.id} label={task.text} />
          </li>
        ))}
      </ul>
      <form action={addTask} className="mt-3">
        <input type="hidden" name="job_id" value={jobId} />
        <input name="text" placeholder="+ Add a task and press Enter" className="field" autoComplete="off" />
      </form>
    </Section>
  );
}

export function InterviewsSection({ jobId, interviews }: { jobId: number; interviews: Interview[] }) {
  const todayStr = today();
  return (
    <Section title="Interviews" count={interviews.length}>
      {interviews.length === 0 && <Empty>No interviews scheduled.</Empty>}
      <ul className="space-y-2">
        {interviews.map((iv) => (
          <li key={iv.id} className="flex items-start gap-2">
            <div className="flex-1">
              <p className={`text-sm font-medium ${iv.scheduled_at < todayStr ? "text-slate-400" : ""}`}>
                {formatDateTime(iv.scheduled_at)}
                {iv.kind && <span className="font-normal text-slate-500"> · {iv.kind}</span>}
              </p>
              {iv.notes && <p className="text-sm text-slate-500">{iv.notes}</p>}
            </div>
            <DeleteButton kind="interview" id={iv.id} label="interview" />
          </li>
        ))}
      </ul>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-900">+ Add interview</summary>
        <form action={addInterview} className="mt-2 space-y-2">
          <input type="hidden" name="job_id" value={jobId} />
          <input name="scheduled_at" type="datetime-local" required className="field" />
          <input name="kind" placeholder="Type, e.g. Technical, HR screen" className="field" />
          <input name="notes" placeholder="Who with, format, anything to remember" className="field" />
          <SubmitButton variant="secondary">Add interview</SubmitButton>
        </form>
      </details>
    </Section>
  );
}

export function ContactsSection({ jobId, contacts }: { jobId: number; contacts: Contact[] }) {
  return (
    <Section title="Contacts" count={contacts.length}>
      {contacts.length === 0 && <Empty>No contacts yet.</Empty>}
      <ul className="space-y-2">
        {contacts.map((c) => (
          <li key={c.id} className="flex items-start gap-2">
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium">
                {c.name}
                {c.role && <span className="font-normal text-slate-500"> · {c.role}</span>}
              </p>
              {c.email && (
                <a href={`mailto:${c.email}`} className="block truncate text-sky-700 hover:underline">
                  {c.email}
                </a>
              )}
            </div>
            <DeleteButton kind="contact" id={c.id} label={c.name} />
          </li>
        ))}
      </ul>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-900">+ Add contact</summary>
        <form action={addContact} className="mt-2 space-y-2">
          <input type="hidden" name="job_id" value={jobId} />
          <input name="name" required placeholder="Name" className="field" />
          <input name="role" placeholder="Role, e.g. Recruiter" className="field" />
          <input name="email" type="email" placeholder="Email" className="field" />
          <SubmitButton variant="secondary">Add contact</SubmitButton>
        </form>
      </details>
    </Section>
  );
}

export function DocumentsSection({ jobId, documents }: { jobId: number; documents: Document[] }) {
  const kindLabel = (id: string) => DOCUMENT_KINDS.find((k) => k.id === id)?.label ?? "Other";
  return (
    <Section title="Documents" count={documents.length}>
      {documents.length === 0 && <Empty>No documents attached.</Empty>}
      <ul className="space-y-2">
        {documents.map((doc) => (
          <li key={doc.id} className="flex items-start gap-2">
            <div className="min-w-0 flex-1 text-sm">
              <a
                href={`/api/documents/${doc.id}`}
                target="_blank"
                className="block truncate font-medium text-sky-700 hover:underline"
              >
                {doc.filename}
              </a>
              <p className="text-xs text-slate-500">
                {kindLabel(doc.kind)} · added {formatDate(doc.uploaded_at)}
              </p>
            </div>
            <form action={deleteDocument}>
              <input type="hidden" name="id" value={doc.id} />
              <button type="submit" aria-label={`Remove ${doc.filename}`} className="px-1 text-slate-300 hover:text-rose-600">
                ×
              </button>
            </form>
          </li>
        ))}
      </ul>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-900">+ Attach document</summary>
        <form action={uploadDocument} className="mt-2 space-y-2">
          <input type="hidden" name="job_id" value={jobId} />
          <select name="kind" className="field">
            {DOCUMENT_KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
          <input
            name="file"
            type="file"
            required
            accept=".pdf,.docx,.doc,.txt"
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-slate-200"
          />
          <SubmitButton variant="secondary" pendingText="Uploading…">
            Upload
          </SubmitButton>
        </form>
      </details>
    </Section>
  );
}
