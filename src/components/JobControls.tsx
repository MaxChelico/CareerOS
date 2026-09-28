"use client";

import { useTransition } from "react";
import { deleteJob, moveJob } from "@/app/actions";
import { STAGES, stageOf, type StageId } from "@/lib/stages";

export function StatusSelect({ jobId, status }: { jobId: number; status: StageId }) {
  const [pending, startTransition] = useTransition();
  return (
    <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white py-1 pr-1 pl-2.5 text-sm">
      <span className={`h-2 w-2 rounded-full ${stageOf(status).dot}`} />
      <select
        aria-label="Status"
        value={status}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as StageId;
          startTransition(() => moveJob(jobId, next));
        }}
        className="cursor-pointer bg-transparent pr-1 font-medium outline-none"
      >
        {STAGES.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function DeleteJobButton({ jobId, company }: { jobId: number; company: string }) {
  return (
    <form
      action={deleteJob}
      onSubmit={(e) => {
        if (!confirm(`Delete ${company} and everything saved with it? This can't be undone.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={jobId} />
      <button type="submit" className="text-sm text-slate-400 hover:text-rose-600">
        Delete job
      </button>
    </form>
  );
}
