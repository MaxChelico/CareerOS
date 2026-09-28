"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { GenerateState } from "@/app/jobs/[id]/ai-actions";

// A form that runs a slow AI action, showing progress and any error.
export function GenerateForm({
  action,
  jobId,
  label,
  pendingLabel,
  variant = "primary",
  guidance,
  cost,
}: {
  action: (prev: GenerateState, form: FormData) => Promise<GenerateState>;
  jobId: number;
  label: string;
  pendingLabel: string;
  variant?: "primary" | "secondary";
  guidance?: { placeholder: string; defaultValue?: string };
  cost: string; // shown under the button, e.g. "about 5–10¢"
}) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="job_id" value={jobId} />
      {guidance && (
        <textarea
          name="guidance"
          rows={2}
          defaultValue={guidance.defaultValue}
          placeholder={guidance.placeholder}
          className="field"
        />
      )}
      <Submit label={label} pendingLabel={pendingLabel} variant={variant} cost={cost} />
      {state && "error" in state && <p className="text-sm text-rose-700">{state.error}</p>}
    </form>
  );
}

function Submit({
  label,
  pendingLabel,
  variant,
  cost,
}: {
  label: string;
  pendingLabel: string;
  variant: "primary" | "secondary";
  cost: string;
}) {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="submit" disabled={pending} className={variant === "primary" ? "btn-primary" : "btn-secondary"}>
        {pending ? pendingLabel : label}
      </button>
      <span className="text-xs text-slate-400">
        {pending ? "This usually takes under a minute." : `Runs only when you click · costs ${cost}`}
      </span>
    </div>
  );
}

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="btn-secondary"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
