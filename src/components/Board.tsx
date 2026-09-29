"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from "@dnd-kit/core";
import Link from "next/link";
import { useEffect, useOptimistic, useState, useTransition } from "react";
import { moveJob, removeJob, setJobType } from "@/app/actions";
import { daysSince, formatDate } from "@/lib/dates";
import type { JobCard } from "@/lib/jobs";
import { FOLLOW_UP_DAYS, STAGES, type StageId } from "@/lib/stages";
import { colorHex, type JobType } from "@/lib/type-colors";
import { JobTypeBadge } from "./JobTypeBadge";

// Which jobs the board shows: all of them, one type, or jobs with no type yet.
type Filter = "all" | "untyped" | number;

type Change = { id: number; status: StageId } | { id: number; type_id: number | null } | { id: number; deleted: true };

// Where the type menu is open: which job, and where on screen (it floats above the scrolling columns).
type MenuState = { jobId: number; x: number; y: number } | null;

// Drop on whatever is under the pointer, so small type chips can be hit precisely. Fall back to
// the most-overlapped column when the pointer is between targets.
const dropTarget: CollisionDetection = (args) => {
  const underPointer = pointerWithin(args);
  return underPointer.length > 0 ? underPointer : rectIntersection(args);
};

export function Board({ jobs, types }: { jobs: JobCard[]; types: JobType[] }) {
  const [showClosed, setShowClosed] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [activeId, setActiveId] = useState<number | null>(null);
  const [menu, setMenu] = useState<MenuState>(null);
  const [, startTransition] = useTransition();
  // Cards move, change type or disappear immediately; the server catches up in the background.
  const [optimisticJobs, applyChange] = useOptimistic(jobs, (current, change: Change) =>
    "deleted" in change
      ? current.filter((j) => j.id !== change.id)
      : current.map((j) => (j.id === change.id ? { ...j, ...change } : j)),
  );

  // A small movement threshold lets a plain click open the job instead of starting a drag.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const typeById = new Map(types.map((t) => [t.id, t]));
  const matches = (job: JobCard) =>
    filter === "all" || (filter === "untyped" ? job.type_id === null : job.type_id === filter);
  const visibleJobs = optimisticJobs.filter(matches);
  const untypedCount = optimisticJobs.filter((j) => j.type_id === null).length;

  const stages = STAGES.filter((s) => showClosed || !s.closed);
  const closedCount = visibleJobs.filter((j) => STAGES.find((s) => s.id === j.status)?.closed).length;
  const activeJob = optimisticJobs.find((j) => j.id === activeId);
  const filteredType = typeof filter === "number" ? typeById.get(filter) : undefined;
  const menuJob = menu ? optimisticJobs.find((j) => j.id === menu.jobId) : undefined;

  function changeType(jobId: number, typeId: number | null) {
    setMenu(null);
    startTransition(async () => {
      applyChange({ id: jobId, type_id: typeId });
      await setJobType(jobId, typeId);
    });
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    const job = optimisticJobs.find((j) => j.id === active.id);
    if (!job || !over) return;
    // Dropped on a type's filter button: give the job that type.
    const target = String(over.id);
    if (target.startsWith("type:")) {
      const typeId = target === "type:none" ? null : Number(target.slice(5));
      if (job.type_id !== typeId) changeType(job.id, typeId);
      return;
    }
    const status = over.id as StageId;
    if (job.status === status) return;
    startTransition(async () => {
      applyChange({ id: job.id, status });
      await moveJob(job.id, status);
    });
  }

  function handleDelete(job: JobCard) {
    if (!confirm(`Delete ${job.company} (${job.title})?\n\nIts notes, cover letter, interview prep and documents are deleted too. This can't be undone.`)) return;
    startTransition(async () => {
      applyChange({ id: job.id, deleted: true });
      await removeJob(job.id);
    });
  }

  return (
    <DndContext
      id="board"
      sensors={sensors}
      collisionDetection={dropTarget}
      onDragStart={({ active }) => {
        setMenu(null);
        setActiveId(Number(active.id));
      }}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={handleDragEnd}
    >
      {/* Fill the window below the top bar, so each column scrolls on its own instead of the page. */}
      <div className="flex h-[calc(100dvh-57px)] flex-col">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 pt-5 pb-3">
          <h1 className="text-lg font-semibold">Applications</h1>
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
              All <Count n={optimisticJobs.length} />
            </FilterChip>
            {types.map((t) => (
              <FilterChip
                key={t.id}
                dropId={`type:${t.id}`}
                active={filter === t.id}
                onClick={() => setFilter(filter === t.id ? "all" : t.id)}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorHex(t.color) }} />
                {t.name} <Count n={optimisticJobs.filter((j) => j.type_id === t.id).length} />
              </FilterChip>
            ))}
            {(untypedCount > 0 || activeId !== null) && (
              <FilterChip
                dropId="type:none"
                active={filter === "untyped"}
                onClick={() => setFilter(filter === "untyped" ? "all" : "untyped")}
              >
                No type <Count n={untypedCount} />
              </FilterChip>
            )}
            {activeId !== null ? (
              <span className="ml-1 text-xs font-medium text-sky-700">Drop on a type to sort it</span>
            ) : (
              <Link href="/types" className="ml-1 text-xs text-slate-500 hover:text-slate-900">
                Edit types
              </Link>
            )}
          </div>
          <div className="ml-auto flex items-center gap-4">
            {filteredType && (
              <Link
                href={`/jobs/new?type=${filteredType.id}`}
                className="text-sm font-medium text-sky-700 hover:text-sky-900"
              >
                + Add a {filteredType.name} job
              </Link>
            )}
            <button onClick={() => setShowClosed((v) => !v)} className="text-sm text-slate-500 hover:text-slate-900">
              {showClosed ? "Hide closed" : `Show closed (${closedCount})`}
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto px-6 pb-6">
          {stages.map((stage) => (
            <Column
              key={stage.id}
              stage={stage}
              jobs={visibleJobs.filter((j) => j.status === stage.id)}
              typeById={typeById}
              activeId={activeId}
              onDelete={handleDelete}
              onOpenTypeMenu={setMenu}
            />
          ))}
        </div>
      </div>

      <DragOverlay>
        {activeJob && <Card job={activeJob} type={typeById.get(activeJob.type_id ?? -1)} lifted />}
      </DragOverlay>

      {menu && menuJob && (
        <TypeMenu
          menu={menu}
          currentTypeId={menuJob.type_id}
          types={types}
          onPick={(typeId) => changeType(menuJob.id, typeId)}
          onClose={() => setMenu(null)}
        />
      )}
    </DndContext>
  );
}

function FilterChip({
  active,
  onClick,
  dropId,
  children,
}: {
  active: boolean;
  onClick: () => void;
  dropId?: string; // set on type chips, so cards can be dropped onto them
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId ?? "chip:all", disabled: !dropId });
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
        isOver
          ? "scale-110 border-sky-500 bg-sky-50 text-slate-900 ring-2 ring-sky-300"
          : active
            ? "border-slate-900 bg-slate-900 text-white"
            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
      }`}
    >
      {children}
    </button>
  );
}

function Count({ n }: { n: number }) {
  return <span className="font-normal opacity-60">{n}</span>;
}

// A small floating menu for choosing a card's type. Closes on outside click, Escape, or scrolling.
function TypeMenu({
  menu,
  currentTypeId,
  types,
  onPick,
  onClose,
}: {
  menu: NonNullable<MenuState>;
  currentTypeId: number | null;
  types: JobType[];
  onPick: (typeId: number | null) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onClose, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  const options: { id: number | null; name: string; color?: string }[] = [
    ...types.map((t) => ({ id: t.id, name: t.name, color: colorHex(t.color) })),
    { id: null, name: "No type" },
  ];
  // Keep the menu on screen near the window's right and bottom edges.
  const left = Math.min(menu.x, window.innerWidth - 208);
  const top = Math.min(menu.y, window.innerHeight - 44 - 34 * options.length);

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        role="menu"
        aria-label="Set type"
        className="fixed z-50 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        style={{ left, top }}
      >
        <p className="px-3 pt-1 pb-1.5 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Set type</p>
        {options.map((o) => (
          <button
            key={o.id ?? "none"}
            role="menuitemradio"
            aria-checked={o.id === currentTypeId}
            onClick={() => onPick(o.id)}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            <span
              className={`h-2.5 w-2.5 rounded-full ${o.color ? "" : "border border-slate-300"}`}
              style={o.color ? { backgroundColor: o.color } : undefined}
            />
            {o.name}
            {o.id === currentTypeId && <span className="ml-auto text-slate-400">✓</span>}
          </button>
        ))}
      </div>
    </>
  );
}

function Column({
  stage,
  jobs,
  typeById,
  activeId,
  onDelete,
  onOpenTypeMenu,
}: {
  stage: (typeof STAGES)[number];
  jobs: JobCard[];
  typeById: Map<number, JobType>;
  activeId: number | null;
  onDelete: (job: JobCard) => void;
  onOpenTypeMenu: (menu: MenuState) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <section
      ref={setNodeRef}
      className={`flex min-h-0 w-64 shrink-0 flex-col rounded-xl p-2 transition-colors ${
        isOver ? "bg-sky-100/70" : "bg-slate-100"
      }`}
    >
      <header className="flex items-center gap-2 px-2 pt-1 pb-3 text-xs font-semibold tracking-wide text-slate-600 uppercase">
        <span className={`h-2 w-2 rounded-full ${stage.dot}`} />
        {stage.label}
        <span className="ml-auto font-normal text-slate-400">{jobs.length}</span>
      </header>
      {/* The card list scrolls within the column; dragging near its edge scrolls it too. */}
      <div className="column-scroll -mx-1 flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-1 pb-1">
        {jobs.map((job) => (
          <DraggableCard
            key={job.id}
            job={job}
            type={typeById.get(job.type_id ?? -1)}
            dimmed={job.id === activeId}
            onDelete={onDelete}
            onOpenTypeMenu={onOpenTypeMenu}
          />
        ))}
        {jobs.length === 0 && (
          <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-400">
            Drop here
          </p>
        )}
      </div>
    </section>
  );
}

function DraggableCard({
  job,
  type,
  dimmed,
  onDelete,
  onOpenTypeMenu,
}: {
  job: JobCard;
  type: JobType | undefined;
  dimmed: boolean;
  onDelete: (job: JobCard) => void;
  onOpenTypeMenu: (menu: MenuState) => void;
}) {
  const { setNodeRef, attributes, listeners } = useDraggable({ id: job.id });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={`group relative shrink-0 ${dimmed ? "opacity-40" : ""}`}>
      <Card job={job} type={type} />
      <div className="absolute top-2 right-2 hidden gap-0.5 group-hover:flex group-focus-within:flex">
        <CardButton
          label={`Set type for ${job.company}`}
          title="Set type"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            onOpenTypeMenu({ jobId: job.id, x: rect.left, y: rect.bottom + 4 });
          }}
          className="hover:bg-sky-50 hover:text-sky-700"
        >
          {/* tag icon */}
          <path d="M2.5 2.5h5l6 6-5 5-6-6v-5z" />
          <circle cx="5.5" cy="5.5" r="1" />
        </CardButton>
        <CardButton
          label={`Delete ${job.company}`}
          title="Delete job"
          onClick={() => onDelete(job)}
          className="hover:bg-rose-50 hover:text-rose-600"
        >
          {/* trash icon */}
          <path d="M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4M6.8 6.5v4.5M9.2 6.5v4.5" />
        </CardButton>
      </div>
    </div>
  );
}

function CardButton({
  label,
  title,
  onClick,
  className,
  children,
}: {
  label: string;
  title: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title}
      // Keep a press on these buttons from starting a drag or opening the job.
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClick}
      className={`flex h-6 w-6 items-center justify-center rounded-md bg-white/80 text-slate-400 ${className}`}
    >
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {children}
      </svg>
    </button>
  );
}

function Card({ job, type, lifted = false }: { job: JobCard; type: JobType | undefined; lifted?: boolean }) {
  const needsFollowUp =
    job.status === "applied" && job.applied_at !== null && daysSince(job.applied_at) >= FOLLOW_UP_DAYS;

  return (
    <Link
      href={`/jobs/${job.id}`}
      draggable={false}
      // A job's type shows as a coloured stripe down the card's left edge, plus its name below.
      style={type ? { borderLeftColor: colorHex(type.color) } : undefined}
      className={`block rounded-lg border border-slate-200 bg-white p-3 transition hover:border-slate-300 ${
        type ? "border-l-4 pl-2.5" : ""
      } ${lifted ? "rotate-1 cursor-grabbing shadow-lg" : "shadow-sm"}`}
    >
      <p className="pr-12 text-sm font-semibold">{job.company}</p>
      <p className="mt-0.5 text-sm text-slate-600">{job.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
        {type && <JobTypeBadge type={type} />}
        <span>{cardDateLabel(job)}</span>
        {job.next_interview && (
          <span className="rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-700">
            Interview {formatDate(job.next_interview)}
          </span>
        )}
        {needsFollowUp && (
          <span className="rounded bg-rose-50 px-1.5 py-0.5 font-medium text-rose-700">Follow up?</span>
        )}
      </div>
    </Link>
  );
}

function cardDateLabel(job: JobCard): string {
  if (job.status === "saved") return `Saved ${formatDate(job.created_at)}`;
  if (job.applied_at) return `Applied ${formatDate(job.applied_at)}`;
  return `Updated ${formatDate(job.status_changed_at)}`;
}
