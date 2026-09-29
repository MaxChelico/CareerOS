import { colorHex, type JobType } from "@/lib/type-colors";

// A job type's label: its colour as a dot, its name in regular text (colour is never the only cue).
export function JobTypeBadge({ type, size = "sm" }: { type: JobType; size?: "sm" | "md" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-slate-100 font-medium text-slate-700 ${
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
      }`}
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colorHex(type.color) }} />
      {type.name}
    </span>
  );
}

// The dropdown used on the add-job form and the job page.
export function JobTypeSelect({ types, defaultValue }: { types: JobType[]; defaultValue?: number | null }) {
  return (
    <select id="type_id" name="type_id" defaultValue={defaultValue ?? ""} className="field">
      <option value="">No type</option>
      {types.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  );
}
