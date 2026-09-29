"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createJob, importFromPastedText, importFromUrl } from "@/app/actions";
import type { ImportResult } from "@/lib/import-job";
import { SOURCES } from "@/lib/stages";
import type { JobType } from "@/lib/type-colors";
import { JobTypeSelect } from "./JobTypeBadge";
import { SubmitButton } from "./SubmitButton";

const EMPTY = { company: "", title: "", location: "", description: "", source: "" };

// An imported description shorter than this is probably a blurb, not the posting.
const MIN_DESCRIPTION = 300;

export function AddJobForm({ resumeVersions, types }: { resumeVersions: string[]; types: JobType[] }) {
  const [url, setUrl] = useState("");
  const [fields, setFields] = useState(EMPTY);
  const [lastImport, setLastImport] = useState(EMPTY); // what the previous import filled in
  const [status, setStatus] = useState<"saved" | "applied">("saved");
  const [importMessage, setImportMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [importing, startImport] = useTransition();
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasted, setPasted] = useState("");
  const [pasteImporting, startPasteImport] = useTransition();

  const router = useRouter();

  // Leave without saving. Ask first if anything has been typed or imported.
  function cancel() {
    const hasInput = url.trim() !== "" || Object.values(fields).some((v) => v.trim() !== "");
    if (hasInput && !confirm("Discard this job? Nothing you've entered will be saved.")) return;
    router.push("/");
  }

  const set = (key: keyof typeof EMPTY) => (e: { target: { value: string } }) =>
    setFields((f) => ({ ...f, [key]: e.target.value }));

  // Fill the form from an import, then say plainly what (if anything) is still missing.
  function applyImport(result: ImportResult) {
    if (!result.ok) {
      setImportMessage({ ok: false, text: result.error });
      setPasteOpen(true);
      return;
    }
    const job = result.job;
    // Replace blanks and anything a previous import filled in, but never what the user typed.
    const keep = (key: keyof typeof EMPTY, current: string) =>
      current && current !== lastImport[key] ? current : job[key] || current;
    setFields((f) => ({
      company: keep("company", f.company),
      title: keep("title", f.title),
      location: keep("location", f.location),
      description: keep("description", f.description),
      source: keep("source", f.source),
    }));
    setLastImport(job);

    const missingDescription = job.description.trim().length < MIN_DESCRIPTION;
    const missing = [!job.title && "the job title", missingDescription && "the full description"].filter(Boolean);
    if (missing.length > 0) {
      setImportMessage({
        ok: false,
        text: `Only partly imported: couldn't find ${missing.join(" or ")}. Use “Paste the job page” below to fill in the rest.`,
      });
      setPasteOpen(true);
    } else if (!job.company) {
      setImportMessage({ ok: true, text: "Imported. This site doesn't provide the company name, so please type it in." });
    } else {
      setImportMessage({ ok: true, text: "Imported. Check the details below before saving." });
    }
  }

  function handleImport() {
    startImport(async () => applyImport(await importFromUrl(url)));
  }

  function handlePaste() {
    startPasteImport(async () => {
      const result = await importFromPastedText(pasted);
      applyImport(result);
      if (result.ok) setPasteOpen(false);
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

        {/* Fallback for any site that can't be imported from its link, LinkedIn included. */}
        <div className="mt-3 rounded-lg border border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => setPasteOpen((o) => !o)}
            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-slate-700"
          >
            Paste the job page
            <span className="text-xs font-normal text-slate-400">{pasteOpen ? "Hide" : "For sites that don't import"}</span>
          </button>
          {pasteOpen && (
            <div className="space-y-2 border-t border-slate-100 p-3">
              <p className="text-xs text-slate-500">
                On the job posting, press <kbd className="rounded bg-slate-100 px-1">Ctrl</kbd> +{" "}
                <kbd className="rounded bg-slate-100 px-1">A</kbd> to select everything, then{" "}
                <kbd className="rounded bg-slate-100 px-1">Ctrl</kbd> + <kbd className="rounded bg-slate-100 px-1">C</kbd>{" "}
                to copy it, and paste it here. Menus and other clutter are fine; they get stripped out.
              </p>
              <textarea
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                rows={6}
                placeholder="Paste the copied page here"
                className="field text-xs"
              />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handlePaste}
                  disabled={pasted.trim().length < 100 || pasteImporting}
                  className="btn-secondary"
                >
                  {pasteImporting ? "Sorting it out…" : "Fill in the form from this"}
                </button>
                <span className="text-xs text-slate-400">
                  {pasteImporting ? "This usually takes 10–30 seconds." : "Runs only when you click · costs about 1–3¢"}
                </span>
              </div>
            </div>
          )}
        </div>
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
        <div>
          <div className="flex items-baseline justify-between">
            <Label htmlFor="type_id">Type</Label>
            <Link href="/types" className="text-xs text-slate-500 hover:text-slate-900">
              Edit types
            </Link>
          </div>
          <JobTypeSelect types={types} />
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

      <div className="flex justify-end gap-2">
        <button type="button" onClick={cancel} className="btn-secondary">
          Cancel
        </button>
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
