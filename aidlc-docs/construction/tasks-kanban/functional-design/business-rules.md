# Business Rules -- UOW-03: Tasks & Kanban Board

## Overview

All business rules for UOW-03 are listed below with unique IDs (BR-03-XXX), rule statement, validation logic, and error messages. Rules are grouped by domain: Task Creation, Kanban Board, Drag-and-Drop, Task Card Display, Pipeline Interaction, and Limits.

---

## Task Creation Rules

### BR-03-001: Task Title Required

| Field | Value |
|-------|-------|
| **Rule** | Task title is required, 1-200 characters |
| **Validation** | Zod `z.string().min(1, "Title is required").max(200, "Title must be 200 characters or fewer").trim()`. Leading/trailing whitespace trimmed before length check. |
| **Error Message** | Empty: "Title is required" / Too long: "Title must be 200 characters or fewer" |
| **Enforcement** | Client-side (TaskCreationModal inline validation, on blur + submit), Server-side (API route Zod schema) |
| **Stories** | US-014 |

### BR-03-002: Task Description Optional

| Field | Value |
|-------|-------|
| **Rule** | Task description is optional, max 5000 characters |
| **Validation** | Zod `z.string().max(5000, "Description must be 5000 characters or fewer").optional().or(z.literal(""))`. Empty string treated as null on server. |
| **Error Message** | "Description must be 5000 characters or fewer" |
| **Enforcement** | Client-side (character counter + inline validation), Server-side (API route Zod schema) |
| **Stories** | US-013 |

### BR-03-003: Category Required

| Field | Value |
|-------|-------|
| **Rule** | Category is required, one of: Feature, Bug Fix, Refactoring, Performance, Security, UI/UX |
| **Validation** | Zod `z.enum(["feature", "bug-fix", "refactoring", "performance", "security", "ui-ux"])`. Select component enforces valid value; free-text not allowed. |
| **Error Message** | "Category is required" |
| **Enforcement** | Client-side (select component, validated on submit), Server-side (API route Zod enum) |
| **Stories** | US-013 |

### BR-03-004: Priority Required

| Field | Value |
|-------|-------|
| **Rule** | Priority is required, one of: Low, Medium, High, Critical |
| **Validation** | Zod `z.enum(["low", "medium", "high", "critical"])`. Select component enforces valid value. Default: "medium" pre-selected in form. |
| **Error Message** | "Priority is required" |
| **Enforcement** | Client-side (select component, validated on submit), Server-side (API route Zod enum) |
| **Stories** | US-013 |

---

## Kanban Board Rules

### BR-03-005: Tasks Scoped to Project

| Field | Value |
|-------|-------|
| **Rule** | User can only see and manipulate tasks belonging to the active project they own |
| **Validation** | Server-side: every task API call includes `projectId` parameter. TaskService verifies `project.userId === session.userId` before any operation. Client-side: taskStore.fetchTasks filters by projectStore.activeProjectId. |
| **Error Message** | "Task not found" (generic 404, no ownership leak) |
| **Enforcement** | Server-side (TaskService ownership check on every operation) |
| **Stories** | US-017 |

### BR-03-006: Valid Status Transitions

| Field | Value |
|-------|-------|
| **Rule** | Manual drag allows any column transition (adjacent or non-adjacent). Pipeline auto-moves forward only: backlog -> spec -> building -> review -> done. |
| **Validation** | Manual (DnD): no transition restriction -- user can drag to any column. Pipeline (SSE auto-move): PipelineOrchestrator enforces forward-only transitions in the state machine. Server PATCH endpoint accepts any valid status enum value. |
| **Error Message** | N/A (all manual transitions allowed; pipeline transitions enforced server-side) |
| **Enforcement** | Server-side (PipelineOrchestrator state machine for auto-moves), Client-side (DnD allows all) |
| **Stories** | US-018, US-019 |

### BR-03-007: Active Pipeline Drag Restriction

| Field | Value |
|-------|-------|
| **Rule** | Cannot drag a task with an active pipeline to any column except Backlog (which cancels the pipeline) |
| **Validation** | Client-side: onDragEnd checks `task.pipelineState?.isActive`. If true and target is not "backlog", reject the drop. If target is "backlog", proceed and trigger pipeline cancellation via `POST /api/pipeline/[taskId]/cancel`. |
| **Error Message** | "Cannot move task with an active pipeline. Drag to Backlog to cancel." |
| **Enforcement** | Client-side (DnD onDragEnd guard), Server-side (cancel endpoint) |
| **Stories** | US-018 |

---

## Create & Start Rules

### BR-03-008: Create & Start Requires API Key

| Field | Value |
|-------|-------|
| **Rule** | "Create & Start" button requires a valid API key in localStorage; show error if missing |
| **Validation** | Client-side: check for `ac_api_key` in localStorage before calling start-pipeline. If absent or decryption fails, block the action. Show inline error in modal, do not close modal. |
| **Error Message** | "API key required. Configure your Anthropic API key in Settings to start pipelines." |
| **Enforcement** | Client-side (TaskCreationModal pre-flight check), Server-side (API route validates `x-anthropic-key` header) |
| **Stories** | US-015 |

---

## Task Limit Rules

### BR-03-009: Maximum Tasks Per Project

| Field | Value |
|-------|-------|
| **Rule** | Maximum 100 tasks per project |
| **Validation** | Server-side: before creating a new task, count existing tasks for the project. If count >= 100, reject with error. Client-side: optional pre-check (fetch count from taskStore.tasks.length). |
| **Error Message** | "Project has reached the maximum of 100 tasks. Delete existing tasks to create new ones." |
| **Enforcement** | Server-side (TaskService.createTask count check), Client-side (optional warning) |
| **Stories** | US-012 |

---

## Task Card Display Rules

### BR-03-010: Phase Indicator Colors

| Field | Value |
|-------|-------|
| **Rule** | Phase indicator color maps to pipeline phase: amber for planning, blue for coding, purple for reviewing, green for done, gray for idle/backlog |
| **Validation** | PhaseIndicator component reads `task.pipelineState?.phase` and maps to color constant. Mapping is deterministic and exhaustive. |
| **Color Map** | `idle/null`: gray (#6B7280), `planning`: amber (#F59E0B), `coding`: blue (#3B82F6), `reviewing`: purple (#8B5CF6), `completed`: green (#22C55E), `failed`: red (#EF4444) |
| **Enforcement** | Client-side (PhaseIndicator component) |
| **Stories** | US-020 |

### BR-03-011: Pulse Dot Visibility

| Field | Value |
|-------|-------|
| **Rule** | Pulse dot is visible only when the pipeline is actively running for that task |
| **Validation** | PulseDot component renders conditionally: `task.pipelineState?.isActive === true`. When pipeline completes, fails, or is cancelled, `isActive` is set to false by SSE event handler, hiding the dot. |
| **Error Message** | N/A (UI behavior rule) |
| **Enforcement** | Client-side (PulseDot conditional render + taskStore.updatePipelineState) |
| **Stories** | US-020 |

### BR-03-012: Timestamp Display Format

| Field | Value |
|-------|-------|
| **Rule** | Timestamp shows relative time (e.g., "2h ago") by default; absolute time on hover |
| **Validation** | TaskCard renders `task.updatedAt` using a relative time formatter. Hover triggers a Tooltip showing ISO-formatted absolute time. Relative calculation uses client-side current time. |
| **Display** | Default: "2h ago", "3d ago", "just now". Hover tooltip: "Feb 26, 2026 at 14:32" |
| **Enforcement** | Client-side (TaskCard + Tooltip) |
| **Stories** | US-020 |

---

## Rules Summary Matrix

| Rule ID | Domain | Type | Enforcement |
|---------|--------|------|------------|
| BR-03-001 | Task Creation | Input validation | Client + Server |
| BR-03-002 | Task Creation | Input validation | Client + Server |
| BR-03-003 | Task Creation | Input validation | Client + Server |
| BR-03-004 | Task Creation | Input validation | Client + Server |
| BR-03-005 | Kanban Board | Access control | Server |
| BR-03-006 | Kanban Board | Status transition | Server (pipeline) + Client (DnD) |
| BR-03-007 | Drag-and-Drop | Pipeline guard | Client + Server |
| BR-03-008 | Create & Start | Pre-condition | Client + Server |
| BR-03-009 | Task Limits | Capacity constraint | Server |
| BR-03-010 | Task Card Display | UI mapping | Client |
| BR-03-011 | Task Card Display | Conditional render | Client |
| BR-03-012 | Task Card Display | Display format | Client |
