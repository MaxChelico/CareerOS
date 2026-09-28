"use client";

import { useState } from "react";
import { saveCoverLetter } from "@/app/jobs/[id]/ai-actions";
import { CopyButton } from "./GenerateForm";
import { SubmitButton } from "./SubmitButton";

export function CoverLetterEditor({ jobId, content }: { jobId: number; content: string }) {
  const [text, setText] = useState(content);
  const [savedText, setSavedText] = useState(content);
  const unsaved = text !== savedText;

  return (
    <form
      action={async (form) => {
        await saveCoverLetter(form);
        setSavedText(text);
      }}
      className="space-y-3"
    >
      <input type="hidden" name="job_id" value={jobId} />
      <textarea
        name="content"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={22}
        className="field font-serif text-[15px] leading-relaxed"
      />
      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton variant={unsaved ? "primary" : "secondary"} pendingText="Saving…">
          {unsaved ? "Save changes" : "Saved"}
        </SubmitButton>
        <CopyButton text={text} />
        <a
          href={`/api/jobs/${jobId}/cover-letter`}
          className={`btn-secondary ${unsaved ? "pointer-events-none opacity-50" : ""}`}
          title={unsaved ? "Save your changes first" : undefined}
        >
          Download .docx
        </a>
        {unsaved && <span className="text-xs text-amber-700">Unsaved changes</span>}
      </div>
    </form>
  );
}
