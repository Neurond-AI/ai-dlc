# NFR Requirements -- UOW-03: Tasks & Kanban Board

## Overview

Non-functional requirements specific to UOW-03: task CRUD, Kanban board with 5 columns, dnd-kit drag-and-drop, task creation modal, task cards with rich metadata, and task detail view shell. Each NFR has a unique ID (NFR-03-XXX), measurable target, verification method, and SECURITY rule mapping where applicable.

**Baseline**: UOW-01 NFRs (NFR-01-001 through NFR-01-023) cover the shared tech stack, security headers, auth, structured logging, TypeScript strict, Zod validation patterns, responsive layout, toast notifications, and keyboard navigation. This document covers **additional concerns specific to UOW-03 only**.

---

## Performance

### NFR-03-001: Kanban Board Render Time

| Field | Value |
|-------|-------|
| **Category** | Performance |
| **Requirement** | Kanban board must render within 500ms for 100 tasks |
| **Metric/Target** | Time from taskStore.fetchTasks completion to fully painted 5-column board < 500ms with 100 task cards distributed across columns. Measured via React Profiler commit duration. |
| **SECURITY Mapping** | N/A |
| **Verification** | Seed database with 100 tasks for a single project (distributed: 30 backlog, 20 spec, 20 building, 15 review, 15 done). Measure React Profiler commit time for KanbanBoard component. Must be under 500ms. No visible jank or layout shift during render. |

### NFR-03-002: Drag-and-Drop Response Time

| Field | Value |
|-------|-------|
| **Category** | Performance |
| **Requirement** | Drag-and-drop card movement must respond within 100ms using optimistic UI |
| **Metric/Target** | From drop event to card appearing in target column < 100ms. Optimistic update applied immediately in taskStore before API call. Server PATCH call fires asynchronously. |
| **SECURITY Mapping** | N/A |
| **Verification** | Drag a task card from Backlog to Building column. Card must appear in Building column within 100ms of drop (before network response). Measure via Performance API or console.time around onDragEnd handler. Network waterfall shows PATCH request fires after UI update. |

### NFR-03-003: Card Animation Frame Rate

| Field | Value |
|-------|-------|
| **Category** | Performance |
| **Requirement** | Task card animations must maintain >= 60fps |
| **Metric/Target** | Framer Motion layout animations (card enter/exit, column reorder) maintain 60fps. No dropped frames visible during drag overlay movement or AnimatePresence transitions. |
| **SECURITY Mapping** | N/A |
| **Verification** | Open Chrome DevTools Performance tab. Record while: (1) dragging a card across columns, (2) creating a new task (card animates into column), (3) deleting a task (card animates out). Frame rate graph must show consistent 60fps. No long frames (> 16.7ms) during animations. |

### NFR-03-004: Board Re-render on SSE Event

| Field | Value |
|-------|-------|
| **Category** | Performance |
| **Requirement** | Board must re-render within 200ms when an SSE task-status event updates a task's column |
| **Metric/Target** | From SSE `task-status` event receipt to card appearing in new column < 200ms. taskStore subscription triggers KanbanBoard re-render. Card animates to new column via Framer Motion layout animation. |
| **SECURITY Mapping** | N/A |
| **Verification** | Start a pipeline on a task (Backlog -> Spec auto-move). Measure time from SSE event timestamp to card render in Spec column using Performance API. Must be under 200ms. Card transition should be visually smooth (animated, not teleported). |

---

## Security

### NFR-03-005: Task CRUD Ownership Enforcement

| Field | Value |
|-------|-------|
| **Category** | Security |
| **Requirement** | All task operations must enforce both project ownership and user ownership |
| **Metric/Target** | Every TaskService method verifies: (1) project exists, (2) project.userId === session.userId, (3) task.projectId matches the verified project. Two-layer check: user owns project, task belongs to project. Unauthorized access returns 404. |
| **SECURITY Mapping** | SECURITY-08 (Application-Level Access Control) |
| **Verification** | Create two users A and B, each with a project. User A creates a task. User B attempts: GET /api/tasks?projectId=[A's project], PATCH /api/tasks/[A's task], DELETE /api/tasks/[A's task]. All must return 404. User B attempts to create a task in A's project via POST with A's projectId -- must return 404. |

### NFR-03-006: Task Input Validation

| Field | Value |
|-------|-------|
| **Category** | Security |
| **Requirement** | Task creation and update inputs must be validated via Zod schema on both client and server |
| **Metric/Target** | Shared Zod schema in `lib/validations/task-schemas.ts`. Validates: title (1-200 chars, trimmed), description (optional, max 5000 chars), category (enum), priority (enum), status (enum). SQL injection, XSS, and oversized inputs rejected with 400. |
| **SECURITY Mapping** | SECURITY-05 (Input Validation) |
| **Verification** | Send POST /api/tasks with: empty title, 201-char title, invalid category ("hacking"), invalid priority ("ultra"), 5001-char description, SQL injection in title, XSS in description. All must return 400 with field-level Zod errors. No 500 responses. Verify same schema imported in TaskCreationModal and API route. |

### NFR-03-007: API Key Client-Side Only

| Field | Value |
|-------|-------|
| **Category** | Security |
| **Requirement** | Anthropic API key must never be sent to the server for storage; only passed per-request in the `x-anthropic-key` header |
| **Metric/Target** | API key stored in localStorage (`ac_api_key`) on the client only. Sent as `x-anthropic-key` header on pipeline start requests. Server reads from header, uses for Anthropic API call, does not persist. No API key column in any database table. No API key in request body. |
| **SECURITY Mapping** | SECURITY-12 (Authentication and Credential Management) |
| **Verification** | Inspect Prisma schema -- no `apiKey` field on User or any model. Inspect start-pipeline API route -- reads `req.headers.get('x-anthropic-key')`, does not write to DB. Inspect Network tab on "Create & Start" -- API key appears only in request header, not in body. Search codebase for `apiKey` DB write operations -- must find zero. |

---

## Usability

### NFR-03-008: Keyboard-Accessible Drag-and-Drop

| Field | Value |
|-------|-------|
| **Category** | Usability |
| **Requirement** | Drag-and-drop must be operable via keyboard using dnd-kit keyboard sensor |
| **Metric/Target** | dnd-kit `KeyboardSensor` enabled with `sortableKeyboardCoordinates`. Users can: Tab to task card, Space to pick up, Arrow keys to move between columns, Space to drop. Screen reader announces drag state. |
| **SECURITY Mapping** | N/A |
| **Verification** | Navigate to Kanban board using keyboard only. Tab to a task card. Press Space -- card enters "picked up" state (visual indicator + screen reader announcement). Press Right Arrow -- card moves to next column visually. Press Space -- card drops in new column. Verify task status updated via API. |

### NFR-03-009: Touch-Friendly Drag on Tablet

| Field | Value |
|-------|-------|
| **Category** | Usability |
| **Requirement** | Drag-and-drop must support touch input with a 250ms delay to prevent accidental drags during scroll |
| **Metric/Target** | dnd-kit `TouchSensor` configured with `activationConstraint: { delay: 250, tolerance: 5 }`. Short taps and scroll gestures do not trigger drag. Long-press (250ms) activates drag mode. |
| **SECURITY Mapping** | N/A |
| **Verification** | Open board on tablet (or Chrome DevTools device emulation with touch). Quick tap on card -- navigates or no action (no drag). Quick scroll through column -- scrolls normally (no accidental drag). Long-press (250ms+) on card -- drag activates with visual feedback. Drop on target column works correctly. |

### NFR-03-010: Loading Skeleton

| Field | Value |
|-------|-------|
| **Category** | Usability |
| **Requirement** | Board must show loading skeleton while task data is being fetched |
| **Metric/Target** | KanbanBoard shows 5 skeleton columns with 3 skeleton cards each while taskStore.isLoading is true. Skeleton uses shadcn/ui Skeleton component with pulse animation. Renders immediately on page load (no blank state flash). |
| **SECURITY Mapping** | N/A |
| **Verification** | Throttle network to Slow 3G in DevTools. Navigate to /board. Skeleton columns with animated placeholder cards must appear immediately. When data loads, skeleton transitions to real cards. No empty board flash between skeleton and data. |

---

## Reliability

### NFR-03-011: Optimistic UI Rollback

| Field | Value |
|-------|-------|
| **Category** | Reliability |
| **Requirement** | Optimistic UI updates must roll back on API failure with error toast |
| **Metric/Target** | On drag-and-drop: (1) card moves immediately (optimistic), (2) PATCH request fires, (3) on success: no action, (4) on failure: card reverts to original column + error toast shown. Rollback must happen within 200ms of error response. |
| **SECURITY Mapping** | SECURITY-15 (Fail-Safe Defaults) |
| **Verification** | Simulate API failure: block PATCH /api/tasks/[id] in DevTools Network tab (or return 500 from server). Drag card from Backlog to Building. Card appears in Building (optimistic). After API failure, card must revert to Backlog within 200ms. Error toast: "Failed to update task status" must appear. No stale state in taskStore. |

### NFR-03-012: Maximum Tasks Per Project Enforcement

| Field | Value |
|-------|-------|
| **Category** | Reliability |
| **Requirement** | Maximum 100 tasks per project must be enforced server-side |
| **Metric/Target** | TaskService.createTask counts existing tasks for the project before insert. If count >= 100, returns 400 with error message. Client receives error and shows toast. No partial state corruption. |
| **SECURITY Mapping** | SECURITY-15 (Fail-Safe Defaults) |
| **Verification** | Seed a project with 100 tasks. Attempt POST /api/tasks with that projectId. Must return 400 with message "Project has reached the maximum of 100 tasks. Delete existing tasks to create new ones." Verify task count in DB is still 100 (no 101st task created). Client shows error toast. |

---

## SECURITY Compliance Matrix (UOW-03 Additions)

UOW-01 baseline covers SECURITY-01 through SECURITY-15. UOW-03 adds unit-specific enforcement for the following rules only:

| SECURITY Rule | Rule Name | UOW-03 Addition | NFR ID |
|---------------|-----------|-----------------|--------|
| SECURITY-05 | Input Validation | Zod schema for task fields (title, description, category, priority, status) | NFR-03-006 |
| SECURITY-08 | Application-Level Access Control | Two-layer ownership check: user owns project, task belongs to project | NFR-03-005 |
| SECURITY-12 | Authentication and Credential Management | API key client-only, per-request header, no server storage | NFR-03-007 |
| SECURITY-15 | Exception Handling and Fail-Safe Defaults | Optimistic rollback on failure; server-side task limit enforcement | NFR-03-011, NFR-03-012 |

**Note on dnd-kit**: dnd-kit is a client-only library. All drag-and-drop logic runs in the browser. It introduces no new server-side attack surface. The only server interaction is the existing PATCH /api/tasks/[id] endpoint (already validated and auth-protected).

All other SECURITY rules (01-04, 06-07, 09-11, 13-14) are fully covered by UOW-01 baseline NFRs and require no additional UOW-03-specific implementation.

---

## NFR Summary Matrix

| NFR ID | Category | Short Description | Target | SECURITY Rule |
|--------|----------|------------------|--------|---------------|
| NFR-03-001 | Performance | Kanban board render | < 500ms for 100 tasks | -- |
| NFR-03-002 | Performance | DnD response time | < 100ms (optimistic) | -- |
| NFR-03-003 | Performance | Card animation FPS | >= 60fps | -- |
| NFR-03-004 | Performance | SSE board re-render | < 200ms | -- |
| NFR-03-005 | Security | Task ownership enforcement | Two-layer check, 404 on violation | SECURITY-08 |
| NFR-03-006 | Security | Task input validation | Zod, shared client/server | SECURITY-05 |
| NFR-03-007 | Security | API key client-only | Header-only, no DB storage | SECURITY-12 |
| NFR-03-008 | Usability | Keyboard DnD | dnd-kit KeyboardSensor | -- |
| NFR-03-009 | Usability | Touch DnD | 250ms delay, tolerance 5px | -- |
| NFR-03-010 | Usability | Loading skeleton | 5 columns x 3 skeleton cards | -- |
| NFR-03-011 | Reliability | Optimistic rollback | Revert + error toast on failure | SECURITY-15 |
| NFR-03-012 | Reliability | Task limit enforcement | Max 100 tasks/project, server-side | SECURITY-15 |
