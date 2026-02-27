# Business Rules -- UOW-06: Diff Review & Polish

## Overview

All business rules for UOW-06 are listed below with unique IDs (BR-06-XXX), rule statement, validation logic, and error messages. Rules are grouped by domain: Diff Review Panel, Review Actions, Error Handling UX, Settings & Profile. UOW-06 also depends on several UOW-04 rules (BR-04-013, BR-04-017) for backend behavior -- those are referenced but not redefined.

---

## Diff Review Panel Rules

### BR-06-001: Diff Panel Visibility Condition

| Field | Value |
|-------|-------|
| **Rule** | Diff review panel is only visible when task is in "review" status |
| **Validation** | DiffReviewPanel component checks `task.status === "review"` AND `pipelineRun.fileChanges !== null` before rendering. If task leaves "review" status (via SSE event), panel auto-closes. |
| **Error Message** | N/A (conditional render, no error). If no file changes: "No file changes to review." |
| **Enforcement** | Client-side (DiffReviewPanel conditional render) |
| **Stories** | US-042 |

### BR-06-007: File Tree Sort Order

| Field | Value |
|-------|-------|
| **Rule** | File tree nodes sorted: directories first (alphabetical), then files (alphabetical) |
| **Validation** | DiffService.buildFileTree() sorts children array at each level: `children.sort((a, b) => { if (a.type !== b.type) return a.type === "directory" ? -1 : 1; return a.name.localeCompare(b.name); })` |
| **Error Message** | N/A (deterministic sort, no error) |
| **Enforcement** | Client-side (DiffService utility) |
| **Stories** | US-043 |

### BR-06-008: Supported Syntax Highlighting Languages

| Field | Value |
|-------|-------|
| **Rule** | Syntax highlighting supports: TypeScript, JavaScript, JSON, CSS, HTML, Markdown, Python, YAML |
| **Validation** | DiffViewer checks `file.language` against a whitelist of supported language identifiers. If language not in list, render as plain monospace text (no highlighting). Language mapping: `{ typescript: "tsx", javascript: "jsx", json: "json", css: "css", html: "html", markdown: "md", python: "python", yaml: "yaml" }` |
| **Error Message** | N/A (graceful fallback to plain text) |
| **Enforcement** | Client-side (DiffViewer / Shiki configuration) |
| **Stories** | US-044 |

### BR-06-009: Diff Viewer Max File Size

| Field | Value |
|-------|-------|
| **Rule** | Diff viewer truncates files exceeding 10,000 lines |
| **Validation** | DiffService.computeDiffs() counts total lines per file. If > 10,000: truncate to first 10,000 lines and append a marker line "--- File truncated (>10,000 lines) ---". Truncation applies to both sides of the diff. |
| **Error Message** | Inline marker in diff: "--- File truncated (>10,000 lines) ---" |
| **Enforcement** | Client-side (DiffService utility) |
| **Stories** | US-044 |

---

## Review Action Rules

### BR-06-002: Approve -- No Forced Scroll Requirement

| Field | Value |
|-------|-------|
| **Rule** | Approve action is always available when task is in "review" status; no forced scroll-through requirement |
| **Validation** | Approve button enabled whenever `task.status === "review"` AND `pipelineRun.status === "passed"`. No tracking of which files the user has viewed. |
| **Error Message** | N/A |
| **Enforcement** | Client-side (ReviewActions button state) |
| **Stories** | US-045 |

### BR-06-003: Request Changes Requires Feedback

| Field | Value |
|-------|-------|
| **Rule** | Request Changes requires feedback text with minimum 10 characters |
| **Validation** | RequestChangesForm validates `feedback.trim().length >= 10` before enabling submit button. Server-side validation in request-changes route also enforces `requestChangesSchema: { feedback: z.string().min(10, "Feedback must be at least 10 characters") }`. |
| **Error Message** | Client: "Feedback must be at least 10 characters" (inline below textarea). Server: same message in 400 response. |
| **Enforcement** | Client-side (form validation) + Server-side (Zod schema in request-changes route) |
| **Stories** | US-046 |

### BR-06-004: Retry Restarts from Planning Phase

| Field | Value |
|-------|-------|
| **Rule** | Retry action restarts the entire pipeline from the PLANNING phase (full restart) |
| **Validation** | Retry route creates a new PipelineRun record (fresh start). Previous PipelineRun is preserved for history but its status changes to "cancelled". Task status set to "spec". Previous fileChanges and reviewFindings are discarded for the new run. |
| **Error Message** | Confirmation dialog: "Retry will restart the entire pipeline from the Planning stage. Current code changes will be discarded. Continue?" |
| **Enforcement** | Server-side (retry route creates new PipelineRun) + Client-side (confirmation dialog) |
| **Stories** | US-047 |

### BR-06-005: Request Changes Restarts from Coding Phase

| Field | Value |
|-------|-------|
| **Rule** | Request Changes restarts the pipeline from the CODING phase with human feedback context |
| **Validation** | request-changes route increments `PipelineRun.iteration`, sets task status to "building", and calls CoderAgent with the feedback appended to the prompt. Pipeline does NOT restart from PLANNING -- Planner subtasks are preserved. |
| **Error Message** | N/A (automatic flow). Toast on client: "Feedback sent -- pipeline restarting from Code phase" |
| **Enforcement** | Server-side (request-changes route, PipelineOrchestrator) |
| **Stories** | US-046 |

### BR-06-006: Approved Task Is Read-Only

| Field | Value |
|-------|-------|
| **Rule** | After approval, task is read-only -- no further pipeline operations allowed |
| **Validation** | When task status = "done": all pipeline action buttons (Start, Retry, Approve, Request Changes) are hidden or disabled. Start-pipeline route rejects tasks not in "backlog" or "spec" (BR-04-001). Approve/request-changes routes reject tasks not in "review". |
| **Error Message** | Server: "Pipeline can only start on tasks in Backlog or Spec status" (BR-04-001). Client: buttons not rendered. |
| **Enforcement** | Server-side (existing route validations) + Client-side (conditional button render) |
| **Stories** | US-045 |

---

## Error Handling UX Rules

### BR-06-010: Error Notification Auto-Dismiss

| Field | Value |
|-------|-------|
| **Rule** | Error toast notification auto-dismisses after 10 seconds unless user interacts |
| **Validation** | Sonner toast configured with `duration: 10000`. If user hovers over toast, auto-dismiss pauses (Sonner default behavior). Inline Alert banner in TaskDetailView persists until manually dismissed or error resolved. |
| **Error Message** | N/A (UX timing rule) |
| **Enforcement** | Client-side (Sonner toast configuration) |
| **Stories** | US-048 |

---

## Settings & Profile Rules

### BR-06-011: Settings Page Accessibility

| Field | Value |
|-------|-------|
| **Rule** | Settings page is accessible at any time, regardless of pipeline state |
| **Validation** | Settings route (`/settings`) is a standard protected page with no pipeline-state preconditions. Sidebar "Settings" nav item always visible and clickable. |
| **Error Message** | N/A |
| **Enforcement** | Client-side (route always accessible via Sidebar) |
| **Stories** | US-052 |

### BR-06-012: Profile Name Validation

| Field | Value |
|-------|-------|
| **Rule** | Profile name changes require non-empty name (1-100 characters) |
| **Validation** | Client: `name.trim().length >= 1 && name.trim().length <= 100`. Server: PATCH /api/auth/me validates with Zod schema `{ name: z.string().min(1, "Name cannot be empty").max(100, "Name must be 100 characters or fewer").trim() }`. |
| **Error Message** | Client inline: "Name cannot be empty" or "Name must be 100 characters or fewer". Server: same messages in 400 response. |
| **Enforcement** | Client-side (form validation) + Server-side (Zod schema in /api/auth/me route) |
| **Stories** | US-054 |

---

## Cross-Reference: UOW-04 Rules Used by UOW-06

These rules are defined in UOW-04 but enforced or surfaced in UOW-06's frontend:

| Rule | Summary | UOW-06 Usage |
|------|---------|-------------|
| BR-04-001 | Pipeline start precondition (backlog/spec only) | Prevents Start Pipeline on approved/done tasks |
| BR-04-013 | Human approve moves task to "done" | Approve button triggers this transition |
| BR-04-017 | Exponential backoff delays (1s, 2s, 4s) | Countdown displayed in ErrorNotification |
| BR-04-004 | API key required in request header | Request Changes and Retry send x-anthropic-key header |

---

## Rules Summary Matrix

| Rule ID | Domain | Type | Enforcement |
|---------|--------|------|------------|
| BR-06-001 | Diff Review Panel | Visibility guard | Client (conditional render) |
| BR-06-002 | Review Actions | UX constraint | Client (button state) |
| BR-06-003 | Review Actions | Input validation | Client + Server (Zod) |
| BR-06-004 | Review Actions | Pipeline flow | Server (new PipelineRun) + Client (dialog) |
| BR-06-005 | Review Actions | Pipeline flow | Server (orchestrator) |
| BR-06-006 | Review Actions | State guard | Server (route validation) + Client (render) |
| BR-06-007 | Diff Review Panel | Sort order | Client (DiffService) |
| BR-06-008 | Diff Review Panel | Feature scope | Client (Shiki config) |
| BR-06-009 | Diff Review Panel | Performance guard | Client (DiffService) |
| BR-06-010 | Error Handling | UX timing | Client (Sonner config) |
| BR-06-011 | Settings | Accessibility | Client (route) |
| BR-06-012 | Settings | Input validation | Client + Server (Zod) |
