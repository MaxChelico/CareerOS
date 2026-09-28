"use client";

import { useState } from "react";
import { addItem, deleteItem, updateItem } from "@/app/profile/actions";
import type { Section } from "@/lib/profile-sections";
import { SubmitButton } from "./SubmitButton";

type Item = { id: number; title: string; subtitle: string; dates: string; details: string; source: string };

// An education / experience / project / story entry, with an inline editor.
export function ProfileItemCard({ item, section }: { item: Item; section: Section }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <form
        action={async (form) => {
          await updateItem(form);
          setEditing(false);
        }}
        className="space-y-2 rounded-lg border border-sky-200 bg-sky-50/40 p-3"
      >
        <input type="hidden" name="id" value={item.id} />
        <ItemFields section={section} item={item} />
        <div className="flex gap-2">
          <SubmitButton pendingText="Saving…">Save</SubmitButton>
          <button type="button" onClick={() => setEditing(false)} className="btn-secondary">
            Cancel
          </button>
        </div>
      </form>
    );
  }

  const bullets = item.details.split("\n").filter(Boolean);
  return (
    <div className="group relative rounded-lg px-3 py-2.5 hover:bg-slate-50">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <p className="font-medium">{item.title}</p>
        {item.subtitle && <p className="text-slate-600">· {item.subtitle}</p>}
        {item.dates && <p className="ml-auto text-sm text-slate-500">{item.dates}</p>}
      </div>
      {bullets.length > 0 && (
        <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-sm text-slate-700">
          {bullets.map((line, i) => (
            <li key={i}>{line.replace(/^[•\-–]\s*/, "")}</li>
          ))}
        </ul>
      )}
      <div className="absolute top-2 right-2 hidden gap-1 rounded-md border border-slate-200 bg-white shadow-sm group-hover:flex">
        <button onClick={() => setEditing(true)} className="px-2 py-1 text-xs text-slate-600 hover:text-slate-900">
          Edit
        </button>
        <form
          action={deleteItem}
          onSubmit={(e) => {
            if (!confirm(`Remove "${item.title}" from your profile?`)) e.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={item.id} />
          <button type="submit" className="px-2 py-1 text-xs text-slate-600 hover:text-rose-600">
            Remove
          </button>
        </form>
      </div>
    </div>
  );
}

export function AddItemForm({ section }: { section: Section }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-2 px-3 text-sm text-slate-500 hover:text-slate-900">
        + Add {section.singular}
      </button>
    );
  }

  return (
    <form
      action={async (form) => {
        await addItem(form);
        setOpen(false);
      }}
      className="mt-2 space-y-2 rounded-lg border border-slate-200 p-3"
    >
      <input type="hidden" name="section" value={section.id} />
      <ItemFields section={section} />
      <div className="flex gap-2">
        <SubmitButton pendingText="Adding…">Add</SubmitButton>
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}

function ItemFields({ section, item }: { section: Section; item?: Item }) {
  const hasDates = section.id !== "story";
  return (
    <>
      <input name="title" required autoFocus defaultValue={item?.title} placeholder={section.title} className="field" />
      <div className="flex gap-2">
        <input name="subtitle" defaultValue={item?.subtitle} placeholder={section.subtitle} className="field" />
        {hasDates && (
          <input name="dates" defaultValue={item?.dates} placeholder="Dates" className="field sm:max-w-44" />
        )}
      </div>
      <textarea
        name="details"
        rows={section.id === "story" ? 6 : 4}
        defaultValue={item?.details}
        placeholder={section.details}
        className="field leading-relaxed"
      />
    </>
  );
}
