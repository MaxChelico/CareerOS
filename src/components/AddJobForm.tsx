"use client";

import { useState, useTransition } from "react";
import { createJob, importFromUrl } from "@/app/actions";
import { SOURCES } from "@/lib/stages";
import { SubmitButton } from "./SubmitButton";

const EMPTY = { company: "", title: "", location: "", description: "", source: "" };

export function AddJobForm({ resumeVersions }: { resumeVersions: string[] }) {
  const [url, setUrl] = useState("");
  const [fields, setFields] = useState(EMPTY);
  const [status, setStatus] = useState<"saved" | "applied">("saved");
  const [importMessage, setImportMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [importing, startImport] = useTransition();

  const set = (key: keyof typeof EMPTY) => (e: { target: { value: string } }) =>
    setFields((f) => ({ ...f, [key]: e.target.value }));

  function handleImport() {
    startImport(async () => {
      const result = await importFromUrl(url);
      if (result.ok) {
        // Only fill blanks, so nothing the user already typed is overwritten.
        setFields((f) => ({
          company: f.company || result.job.company,
          title: f.title || result.job.title,
          location: f.location || result.job.location,
          description: f.description || result.job.description,
          source: f.source || result.job.source,
        }));
        setImportMessage({
          ok: true,
          text: result.job.company
            ? "Imported. Check the details below before saving."
            : "Imported. This site doesn't provide the company name, so please type it in.",
        });
      } else {
        setImportMessage({ ok: false, text: result.error });
      }
    });
  }

  return (
    <form action={createJob} className="mt-6 space-y-5">
      <div>
        <Label htmlFor="url">Posting link</Label>
        <div className="flex gap-2">
          <input
            id="url"
            name="url"
            type="url"
            className="field"
            placeholder="https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button type="button" onClick={handleImport} disabled={!url || importing} className="btn-secondary shrink-0">
            {importing ? "Importing…" : "Import"}
          </button>
        </div>
        {importMessage && (
          <p className={`mt-1.5 text-sm ${importMessage.ok ? "text-emerald-700" : "text-amber-700"}`}>
            {importMessage.text}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="company">Company *</Label>
          <input id="company" name="company" required className="field" value={fields.company} onChange={set("company")} />
        </div>
        <div>
          <Label htmlFor="title">Job title *</Label>
          <input id="title" name="title" required className="field" value={fields.title} onChange={set("title")} />
        </div>
        <div>
          <Label htmlFor="location">Location</Label>
          <input id="location" name="location" className="field" value={fields.location} onChange={set("location")} />
        </div>
        <div>
          <Label htmlFor="source">Where you found it</Label>
          <input
            id="source"
            name="source"
            list="sources"
            className="field"
            value={fields.source}
            onChange={set("source")}
          />
          <datalist id="sources">
            {SOURCES.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
      </div>

      <div>
        <Label htmlFor="description">Job description</Label>
        <textarea
          id="description"
          name="description"
          rows={10}
          className="field font-mono text-xs leading-relaxed"
          placeholder="Paste the full posting here. It's saved with the job, so you still have it after the listing comes down."
          value={fields.description}
          onChange={set("description")}
        />
      </div>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-slate-700">Status</legend>
        <div className="flex gap-2">
          {(["saved", "applied"] as const).map((s) => (
            <label
              key={s}
              className={`btn cursor-pointer border ${
                status === s ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              <input
                type="radio"
                name="status"
                value={s}
                checked={status === s}
                onChange={() => setStatus(s)}
                className="sr-only"
              />
              {s === "saved" ? "Saved: haven't applied yet" : "Already applied"}
            </label>
          ))}
        </div>
      </fieldset>

      {status === "applied" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="applied_at">Date applied</Label>
            <input id="applied_at" name="applied_at" type="date" className="field" />
          </div>
          <div>
            <Label htmlFor="resume_version">Resume version sent</Label>
            <input id="resume_version" name="resume_version" list="resume-versions" className="field" placeholder="e.g. v4" />
            <datalist id="resume-versions">
              {resumeVersions.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <SubmitButton pendingText="Saving…">Save job</SubmitButton>
      </div>
    </form>
  );
}

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-700">
      {children}
    </label>
  );
}
