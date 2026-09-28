# CareerOS

A personal job-search dashboard: save jobs → track applications → (soon) match against your resume, prepare for interviews, and review analytics.

Runs locally on your computer. Only you can open it; it isn't reachable from other devices on your network.

## Running it

```bash
npm install     # first time only
npm run dev
```

Then open the address it prints (http://127.0.0.1:3000 by default; use `npm run dev -- -p 3001` if port 3000 is busy).

## Where your data lives

Everything is in the `data/` folder:

- `data/careeros.db`: the database (jobs, notes, tasks, contacts, interviews, status history)
- `data/uploads/`: documents you attach to jobs

To back up CareerOS, copy the `data/` folder.

## Project layout

| Path | What it is |
|---|---|
| `src/app/page.tsx` | The board |
| `src/app/jobs/new/` | Add-a-job page |
| `src/app/jobs/[id]/` | A job's workspace |
| `src/app/actions.ts` | Everything that changes data (server actions) |
| `src/lib/db.ts` | Database setup and schema |
| `src/lib/jobs.ts` | Database queries |
| `src/lib/import-job.ts` | Reads job details from a posting URL |
| `src/lib/stages.ts` | Pipeline stages and other fixed lists |
| `src/components/` | Interactive pieces (board drag-and-drop, add-job form) |

## Roadmap

1. ✅ Tracker: board, job workspaces, URL import
2. ✅ Profile: resume import, editable profile, resume-coach chat
3. ✅ Per-job cover letters, interview prep, practice-interview chat
4. ✅ Analytics: response rate, funnel, weekly activity, breakdowns by source and resume version
