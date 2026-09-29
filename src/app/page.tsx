import Link from "next/link";
import { Board } from "@/components/Board";
import { listJobCards, listJobTypes } from "@/lib/jobs";

export default function BoardPage() {
  const jobs = listJobCards();

  if (jobs.length === 0) {
    return (
      <div className="m-auto max-w-sm text-center">
        <h1 className="text-lg font-semibold">Your board is empty</h1>
        <p className="mt-2 text-sm text-slate-600">
          Add a job you&apos;re interested in by pasting its link or description.
        </p>
        <Link href="/jobs/new" className="btn-primary mt-5">
          + Add your first job
        </Link>
      </div>
    );
  }

  return <Board jobs={jobs} types={listJobTypes()} />;
}
