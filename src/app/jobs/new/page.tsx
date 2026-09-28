import { AddJobForm } from "@/components/AddJobForm";
import { listResumeVersions } from "@/lib/jobs";

export default function NewJobPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-8">
      <h1 className="text-lg font-semibold">Add a job</h1>
      <p className="mt-1 text-sm text-slate-600">
        Paste the posting&apos;s link to fill in the details automatically, or enter them yourself.
      </p>
      <AddJobForm resumeVersions={listResumeVersions()} />
    </div>
  );
}
