import Link from "next/link";
import { AddTypeForm, TypeRow } from "@/components/TypeEditor";
import { countJobsByType, listJobTypes } from "@/lib/jobs";

export default function TypesPage() {
  const types = listJobTypes();
  const counts = countJobsByType();

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-6">
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">
        ← Board
      </Link>
      <h1 className="mt-3 text-lg font-semibold">Job types</h1>
      <p className="mt-1 text-sm text-slate-600">
        Group jobs by field, like Aerospace or Finance. Each type&apos;s colour shows as a stripe on its board cards.
        Set a job&apos;s type on its page or when you add it.
      </p>

      <ul className="mt-5 space-y-2">
        {types.map((t) => (
          // Keyed on name and colour too, so the row resets after a save.
          <TypeRow key={`${t.id}-${t.name}-${t.color}`} type={t} jobCount={counts.get(t.id) ?? 0} />
        ))}
      </ul>
      <div className="mt-3">
        <AddTypeForm key={types.length} usedColors={types.map((t) => t.color)} />
      </div>
    </div>
  );
}
