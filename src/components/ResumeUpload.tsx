"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { importResume, type ImportState } from "@/app/profile/actions";

export function ResumeUpload({ replacing }: { replacing: boolean }) {
  const [state, action] = useActionState<ImportState, FormData>(importResume, null);

  return (
    <form action={action} className="space-y-3">
      <input
        name="resume"
        type="file"
        accept=".pdf,application/pdf"
        required
        className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-slate-200"
      />
      {replacing && (
        <p className="text-xs text-slate-500">
          Everything imported from your current resume will be replaced. Items you added yourself are kept.
        </p>
      )}
      <UploadButton replacing={replacing} />
      {state && "error" in state && <p className="text-sm text-rose-700">{state.error}</p>}
    </form>
  );
}

function UploadButton({ replacing }: { replacing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <div className="flex items-center gap-3">
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Reading your resume…" : replacing ? "Import new version" : "Import resume"}
      </button>
      {pending && <span className="text-sm text-slate-500">This usually takes under a minute.</span>}
    </div>
  );
}
