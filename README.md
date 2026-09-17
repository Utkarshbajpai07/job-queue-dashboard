Live Frontend: https://job-queue-dashboard-zeta.vercel.app
Live Backend: https://job-queue-backend-5rtk.onrender.com

# Mini Job Queue Dashboard

A small job queue management dashboard: NestJS + TypeORM (SQLite by default,
Postgres-ready) backend, React + Vite frontend.

```
job-queue-dashboard/
  backend/    NestJS API
  frontend/   React dashboard
```

## Quick start

### Backend

```bash
cd backend
npm install
cp .env.example .env      # optional - defaults work out of the box
npm run build
npm run start
# API listening on http://localhost:3000
```

For local development with auto-reload: `npm run start:dev`.

A SQLite file (`job-queue.sqlite`) is created automatically on first run in
the `backend/` folder - no separate database install needed. To use Postgres
instead, set `DATABASE_URL` in `.env` (see `.env.example`); the app detects
it and switches drivers automatically, using the same code path.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env      # set VITE_API_URL if backend isn't on localhost:3000
npm run dev
# Dashboard on http://localhost:5173
```

## API

| Method | Path                | Body                          | Notes |
|--------|----------------------|--------------------------------|-------|
| POST   | `/jobs`              | `{ "title": string, "type": string }` | Creates a job with status `pending` |
| GET    | `/jobs`               | -                              | Returns all jobs, newest first |
| PATCH  | `/jobs/:id/status`    | `{ "status": "running" \| "completed" \| "failed" \| "pending" }` | Attempts a state transition |
| DELETE | `/jobs/:id`           | -                              | Deletes a job |

Job shape: `{ id, title, type, status, createdAt }`.

Allowed statuses: `pending`, `running`, `completed`, `failed`.

Allowed transitions:

```
pending -> running -> completed
                   \-> failed
```

`completed` and `failed` are terminal. Any other transition (including
skipping straight from `pending` to `completed`, or moving a `completed`
job back to `running`) is rejected.

### Error responses

- `400 Bad Request` - validation failure (missing/invalid `title`, `type`,
  or `status`; unknown fields on the body).
- `404 Not Found` - job id doesn't exist.
- `409 Conflict` - the requested status transition isn't legal from the
  job's *current* status. This is also what a client sees when it loses a
  race to another concurrent request (see below).

## Design decisions & the concurrency question

The assignment asks specifically about two tabs both trying to move the same
`pending` job to `running` at nearly the same time. Here's how it's handled
and why.

**Where the rule is enforced:** entirely on the backend. The frontend only
*reflects* the state machine (it hides buttons for illegal transitions, e.g.
you won't see a "Mark Running" button on a `completed` job), purely as a UX
nicety so people aren't clicking around expecting things to work.

That matters because of the second point the assignment raises - **the
API can always be called directly**, bypassing the UI entirely (curl,
Postman, a script, a malicious client, a bug in some other consumer). If the
rule only lived in React state, none of that traffic would be protected, and
the database could reach an invalid state like `completed -> running`. So
the API is the actual source of truth and re-validates every transition
itself, regardless of what called it.

**How the race between two simultaneous requests is handled:** the naive
implementation is "read the job, check its status in code, then write the
new status" as three separate steps. That's a classic check-then-act race:
both requests can read `status: "pending"`, both pass the in-application
check, and both write - the job gets "started twice" and, depending on
what the frontend does next, you can end up with confusing double-processing
or lost updates.

Instead, the status update is a **single atomic conditional UPDATE**:

```sql
UPDATE jobs SET status = 'running'
WHERE id = :id AND status = 'pending';
```

The current-status check and the write happen in the same statement, which
the database executes atomically - there's no window between "check" and
"act" for a second request to sneak into. Whichever request's UPDATE
reaches the database first is the one that matches the `WHERE` clause and
flips the row. The second request's UPDATE then runs against a row that no
longer has `status = 'pending'`, so it matches **zero rows**. The backend
detects that (`affected === 0`), re-reads the job to see what actually
happened, and returns a `409 Conflict` explaining the job is no longer in
the expected state - rather than silently double-applying the transition,
overwriting the winner's update, or throwing an ambiguous 500.

This is implemented once, generically, for every transition (see
`ALLOWED_PREVIOUS_STATUS` in `backend/src/jobs/jobs.service.ts`) - the same
mechanism also rejects an invalid transition like `completed -> running`,
because `completed` is simply never in the allowed "from" list for
`running`. So one atomic conditional update gets you both correctness
guarantees (valid state machine + safe concurrency) without needing an
explicit row lock, `SELECT ... FOR UPDATE`, a distributed lock, or a job
queue library - which felt like the right amount of machinery for this
scale of problem, per the assignment's own note not to over-engineer it.

**How the frontend reacts:** each row's status-change button is a normal
optimistic-ish action - on click it calls the API, and on a `409` it shows
the conflict message inline on that row rather than crashing the page. The
dashboard also polls `GET /jobs` every 5 seconds in the background, so a tab
that "lost" a race converges on the true state shortly after, without the
person needing to hit refresh manually. I considered replacing polling with
WebSockets/SSE for instant sync across tabs but judged that out of scope
for this assignment's size - polling is simple, correct, and good enough at
this scale.

## Assumptions & trade-offs

- **No auth.** The assignment doesn't ask for it, and the whole system is a
  single shared queue with no notion of users/ownership. In a real product
  this would need auth + authorization before anything else.
- **`type` is a free-text string, not a fixed enum.** Job "types" (email,
  report, video-encode, ...) felt like something that should be extensible
  by whoever creates jobs, not hardcoded and requiring a backend deploy to
  add a new one. It's still validated as a required, length-capped string.
- **No pagination.** `GET /jobs` returns everything. Fine for a dashboard
  demo; would need pagination/cursoring once job counts get large.
- **Polling instead of realtime push.** Simple and sufficient for showing
  the multi-tab scenario; a production system would likely use
  WebSockets/SSE or a client-side cache library (React Query/SWR) with
  revalidation instead of a fixed interval.
- **SQLite by default.** Zero-setup for running/reviewing the assignment.
  The app also supports Postgres via `DATABASE_URL` for a "real" deployment
  without any code changes, since only portable TypeORM query-builder SQL is
  used.
- **`pending` is not a valid transition target.** Nothing ever moves back
  into `pending` (no "reset" feature exists in this assignment), so that
  entry in the transition table is intentionally empty.

## Bonus: production-readiness improvement

**Chosen: the atomic conditional-update pattern itself, applied generically
to all status transitions (already implemented above), plus structured
`409` responses that tell the caller exactly what happened.**

I chose this over other options (e.g. adding an audit log table, adding
optimistic-locking version numbers, or adding a message-queue-backed worker)
because it directly addresses the failure mode the assignment explicitly
flags as the interesting one - concurrent, conflicting writes to the same
row - with the least new moving parts, and it generalizes: it's the same
one code path enforcing "valid state machine" and "safe under concurrency"
for every transition, present and future. A version-number/optimistic-lock
column would achieve something similar but requires the client to know and
send back a version, which is more moving parts for the same guarantee at
this scale.

If I had more time, the next thing I'd add is a small `job_events` audit
table (one row per transition, with `from_status`, `to_status`, `at`) - so
that when two tabs really do race, there's a durable record of exactly what
happened and in what order, useful for debugging and for showing job
history in the UI.

## What I'd improve with more time

- Optimistic UI updates (update local state immediately, roll back on
  error) instead of waiting for a full refetch after every action.
- Toast notifications instead of inline row errors.
- Pagination + search on the job list.
- An audit/history table per job (see Bonus section).
- Replace polling with SSE/WebSockets for instant cross-tab sync.
- Tests: e2e tests for the transition matrix and the concurrency race
  (a supertest-based test firing two parallel PATCH requests and asserting
  exactly one 200 + one 409), and React component tests.
