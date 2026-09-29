"use client";

import { useActionState, useState } from "react";
import { addJobType, deleteJobType, updateJobType, type TypeFormState } from "@/app/actions";
import { TYPE_COLORS, type JobType, type TypeColor } from "@/lib/type-colors";
import { SubmitButton } from "./SubmitButton";

// One row per existing type: rename it, recolour it, or delete it.
export function TypeRow({ type, jobCount }: { type: JobType; jobCount: number }) {
  const [state, action] = useActionState<TypeFormState, FormData>(updateJobType, null);
  const [name, setName] = useState(type.name);
  const [color, setColor] = useState<TypeColor>(type.color);
  const changed = name.trim() !== type.name || color !== type.color;

  return (
    <li className="rounded-lg border border-slate-200 bg-white p-3">
      <form action={action} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="id" value={type.id} />
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          aria-label="Type name"
          className="field w-44"
        />
        <ColorPicker name="color" value={color} onChange={setColor} />
        <span className="text-xs text-slate-500">
          {jobCount} {jobCount === 1 ? "job" : "jobs"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {changed && (
            <SubmitButton variant="primary" pendingText="Saving…">
              Save
            </SubmitButton>
          )}
          <button
            type="submit"
            formAction={deleteJobType}
            formNoValidate
            onClick={(e) => {
              const note = jobCount ? `\n\nIts ${jobCount} ${jobCount === 1 ? "job keeps" : "jobs keep"} everything else, just without a type.` : "";
              if (!confirm(`Delete the "${type.name}" type?${note}`)) e.preventDefault();
            }}
            className="text-sm text-slate-400 hover:text-rose-600"
          >
            Delete
          </button>
        </div>
      </form>
      {state && "error" in state && <p className="mt-2 text-sm text-rose-700">{state.error}</p>}
    </li>
  );
}

export function AddTypeForm({ usedColors }: { usedColors: string[] }) {
  // Suggest the first colour nobody is using yet.
  const firstFree = TYPE_COLORS.find((c) => !usedColors.includes(c.id))?.id ?? TYPE_COLORS[0].id;
  // The page remounts this form after each add, which clears the name and suggests the next free colour.
  const [state, action] = useActionState<TypeFormState, FormData>(addJobType, null);
  const [name, setName] = useState("");
  const [color, setColor] = useState<TypeColor>(firstFree);

  return (
    <form action={action} className="rounded-lg border border-dashed border-slate-300 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder="New type, e.g. Nuclear"
          aria-label="New type name"
          className="field w-44"
        />
        <ColorPicker name="color" value={color} onChange={setColor} />
        <div className="ml-auto">
          <SubmitButton variant="secondary" pendingText="Adding…">
            Add type
          </SubmitButton>
        </div>
      </div>
      {state && "error" in state && <p className="mt-2 text-sm text-rose-700">{state.error}</p>}
    </form>
  );
}

function ColorPicker({ name, value, onChange }: { name: string; value: TypeColor; onChange: (c: TypeColor) => void }) {
  return (
    <div role="radiogroup" aria-label="Colour" className="flex gap-1.5">
      {TYPE_COLORS.map((c) => (
        <label key={c.id} title={c.label} className="cursor-pointer">
          <input
            type="radio"
            name={name}
            value={c.id}
            checked={value === c.id}
            onChange={() => onChange(c.id)}
            className="peer sr-only"
            aria-label={c.label}
          />
          <span
            className="block h-6 w-6 rounded-full ring-offset-2 transition peer-checked:ring-2 peer-checked:ring-slate-900 peer-focus-visible:ring-2 peer-focus-visible:ring-sky-500"
            style={{ backgroundColor: c.hex }}
          />
        </label>
      ))}
    </div>
  );
}
