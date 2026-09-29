import { AddJobForm } from "@/components/AddJobForm";
import { listJobTypes, listResumeVersions } from "@/lib/jobs";

export default async function NewJobPage({ searchParams }: PageProps<"/jobs/new">) {
  // ?type=<id> comes from the board's "Add a … job" link while a type filter is on.
  const { type } = await searchParams;
  const types = listJobTypes();
  const defaultTypeId = types.find((t) => String(t.id) === type)?.id ?? null;

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-8">
      <h1 className="text-lg font-semibold">Add a job</h1>
      <p className="mt-1 text-sm text-slate-600">
        Paste the posting&apos;s link to fill in the details automatically, or enter them yourself.
      </p>
      <AddJobForm resumeVersions={listResumeVersions()} types={types} defaultTypeId={defaultTypeId} />
    </div>
  );
}
