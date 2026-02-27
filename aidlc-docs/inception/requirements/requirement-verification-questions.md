# Requirements Verification Questions

Answers collected via interactive chat on 2026-02-26.

---

## Question 1
How should the Anthropic API key be provided?

A) User enters their own API key in a Settings page (stored in browser localStorage)
B) Server-side environment variable (single shared key)
C) User enters API key per session (not persisted)
D) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 2
What data persistence layer should be used?

A) In-memory only (no database — data lost on server restart, fine for demo/MVP)
B) SQLite via Prisma (lightweight, file-based, easy setup)
C) PostgreSQL via Prisma (production-grade)
D) Other (please describe after [Answer]: tag below)

[Answer]: C (PostgreSQL via Prisma, launched via Docker locally — resolved from initial "A" answer after contradiction detected with Q5/Q3/Q6)

---

## Question 3
Should the app support user authentication and multi-user access?

A) No auth — single-user local tool (MVP simplicity)
B) Basic auth with login/signup (email + password)
C) OAuth only (Google/GitHub sign-in)
D) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## Question 4
How should real-time agent log streaming be implemented?

A) Server-Sent Events (SSE) — simpler, one-directional, works well for streaming logs
B) WebSocket — bidirectional, more complex but allows interactive control
C) Polling with short intervals (simplest implementation)
D) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 5
Should tasks and generated code persist across browser sessions?

A) Yes — tasks and their outputs should be saved and accessible after page refresh
B) No — ephemeral session only, data lives in memory while app is open
C) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 6
What is the scope for multi-project support?

A) Single project context — all tasks belong to one workspace
B) Multiple projects — user can create/switch between projects
C) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## Question 7
How should generated code/file changes be represented in the Diff Review Panel?

A) Virtual diffs — AI returns file path + content as JSON, displayed as diffs (no actual filesystem writes)
B) Actual file writes to a sandboxed workspace directory, then display real git diffs
C) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 8
What should happen when the Anthropic API fails or rate-limits during a pipeline run?

A) Retry with exponential backoff (max 3 retries), then mark task as failed with error details
B) Pause the pipeline and notify user to manually retry
C) Other (please describe after [Answer]: tag below)

[Answer]: X — Auto-retry after notifying user and getting their approval. (Hybrid: notify first, then retry with backoff on user approval.)

---

## Question 9
Should the app be responsive (mobile/tablet support)?

A) Desktop-only — optimized for 1280px+ screens (IDE-like tool)
B) Responsive — functional on tablet and mobile as well
C) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## Question 10
What is the deployment target for this MVP?

A) Local development only (npm run dev)
B) Vercel deployment
C) Docker container (self-hosted)
D) Other (please describe after [Answer]: tag below)

[Answer]: X — Local dev first, then prepare Docker and Vercel configurations after.

---

## Question 11: Security Extensions
Should security extension rules be enforced for this project?

A) Yes — enforce all SECURITY rules as blocking constraints (recommended for production-grade applications)
B) No — skip all SECURITY rules (suitable for PoCs, prototypes, and experimental projects)
C) Other (please describe after [Answer]: tag below)

[Answer]: A

---
