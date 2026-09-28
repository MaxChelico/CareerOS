"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { moveJob, removeJob } from "@/app/actions";
import { daysSince, formatDate } from "@/lib/dates";
import type { JobCard } from "@/lib/jobs";
import { FOLLOW_UP_DAYS, STAGES, type StageId } from "@/lib/stages";

export function Board({ jobs }: { jobs: JobCard[] }) {
  const [showClosed, setShowClosed] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [, startTransition] = useTransition();
  // Cards move (or disappear) immediately; the server catches up in the background.
  const [optimisticJobs, applyChange] = useOptimistic(
    jobs,
    (current, change: { id: number; status: StageId } | { id: number; deleted: true }) =>
      "deleted" in change
        ? current.filter((j) => j.id !== change.id)
        : current.map((j) => (j.id === change.id ? { ...j, status: change.status } : j)),
  );

  // A small movement threshold lets a plain click open the job instead of starting a drag.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const stages = STAGES.filter((s) => showClosed || !s.closed);
  const closedCount = optimisticJobs.filter((j) => STAGES.find((s) => s.id === j.status)?.closed).length;
  const activeJob = optimisticJobs.find((j) => j.id === activeId);

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    const job = optimisticJobs.find((j) => j.id === active.id);
    const status = over?.id as StageId | undefined;
    if (!job || !status || job.status === status) return;
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
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between px-6 pt-5 pb-3">
        <h1 className="text-lg font-semibold">Applications</h1>
        <button onClick={() => setShowClosed((v) => !v)} className="text-sm text-slate-500 hover:text-slate-900">
          {showClosed ? "Hide closed" : `Show closed (${closedCount})`}
        </button>
      </div>

      <DndContext
        id="board"
        sensors={sensors}
        onDragStart={({ active }) => setActiveId(Number(active.id))}
        onDragCancel={() => setActiveId(null)}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-1 gap-4 overflow-x-auto px-6 pb-6">
          {stages.map((stage) => (
            <Column
              key={stage.id}
              stage={stage}
              jobs={optimisticJobs.filter((j) => j.status === stage.id)}
              activeId={activeId}
              onDelete={handleDelete}
            />
          ))}
        </div>
        <DragOverlay>{activeJob && <Card job={activeJob} lifted />}</DragOverlay>
      </DndContext>
    </div>
  );
}

function Column({
  stage,
  jobs,
  activeId,
  onDelete,
}: {
  stage: (typeof STAGES)[number];
  jobs: JobCard[];
  activeId: number | null;
  onDelete: (job: JobCard) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <section
      ref={setNodeRef}
      className={`flex w-64 shrink-0 flex-col rounded-xl p-2 transition-colors ${
        isOver ? "bg-sky-100/70" : "bg-slate-100"
      }`}
    >
      <header className="flex items-center gap-2 px-2 pt-1 pb-3 text-xs font-semibold tracking-wide text-slate-600 uppercase">
        <span className={`h-2 w-2 rounded-full ${stage.dot}`} />
        {stage.label}
        <span className="ml-auto font-normal text-slate-400">{jobs.length}</span>
      </header>
      <div className="flex min-h-24 flex-1 flex-col gap-2">
        {jobs.map((job) => (
          <DraggableCard key={job.id} job={job} dimmed={job.id === activeId} onDelete={onDelete} />
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

function DraggableCard({ job, dimmed, onDelete }: { job: JobCard; dimmed: boolean; onDelete: (job: JobCard) => void }) {
  const { setNodeRef, attributes, listeners } = useDraggable({ id: job.id });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={`group relative ${dimmed ? "opacity-40" : ""}`}>
      <Card job={job} />
      <button
        type="button"
        aria-label={`Delete ${job.company}`}
        title="Delete job"
        // Keep a press on this button from starting a drag.
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onDelete(job)}
        className="absolute top-2 right-2 hidden h-6 w-6 items-center justify-center rounded-md text-slate-400 group-hover:flex hover:bg-rose-50 hover:text-rose-600 focus-visible:flex"
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
          <path d="M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4M6.8 6.5v4.5M9.2 6.5v4.5" />
        </svg>
      </button>
    </div>
  );
}

function Card({ job, lifted = false }: { job: JobCard; lifted?: boolean }) {
  const needsFollowUp =
    job.status === "applied" && job.applied_at !== null && daysSince(job.applied_at) >= FOLLOW_UP_DAYS;

  return (
    <Link
      href={`/jobs/${job.id}`}
      draggable={false}
      className={`block rounded-lg border border-slate-200 bg-white p-3 transition hover:border-slate-300 ${
        lifted ? "rotate-1 cursor-grabbing shadow-lg" : "shadow-sm"
      }`}
    >
      <p className="pr-6 text-sm font-semibold">{job.company}</p>
      <p className="mt-0.5 text-sm text-slate-600">{job.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
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
