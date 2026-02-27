# Business Logic Model -- UOW-03: Tasks & Kanban Board

## Overview

This document defines the business processes for UOW-03, covering task creation, Kanban board rendering, drag-and-drop status transitions, task card display, real-time auto-animation via SSE events, task detail navigation, task deletion, empty states, and the taskStore. TaskService handles all server-side CRUD and status logic. The frontend uses dnd-kit for drag-and-drop, Framer Motion for animations, and Zustand for client state.

---

## 1. Create Task (Modal)

**Trigger**: User clicks "New Task" button on the Kanban board toolbar

```
Client (TaskCreationModal)
  |
  [1] Open modal (uiStore.openTaskModal())
  [2] Collect form inputs:
      - title: required text input (1-200 chars)
      - description: optional textarea (max 5000 chars)
      - category: required select (Feature / Bug Fix / Refactoring / Performance / Security / UI/UX)
      - priority: required select (Low / Medium / High / Critical)
  |
  [3] Client-side validation (Zod):
      - title: z.string().min(1).max(200).trim()
      - description: z.string().max(5000).optional()
      - category: z.enum(["feature", "bug-fix", "refactoring", "performance", "security", "ui-ux"])
      - priority: z.enum(["low", "medium", "high", "critical"])
  |
  [4a] User clicks "Create":
      - POST /api/tasks { title, description, category, priority, projectId }
      - Server: validate input -> create Task record (status: "backlog") -> return Task
      - Client: taskStore.addTask(task) -> close modal -> show success toast
  |
  [4b] User clicks "Create & Start":
      - [Pre-flight] Check localStorage for API key (BR-03-008)
        - If missing: show error "Configure API key in Settings" -> abort
      - POST /api/tasks { title, description, category, priority, projectId }
      - Server: create Task record (status: "backlog") -> return Task
      - Client: taskStore.addTask(task)
      - POST /api/tasks/[id]/start-pipeline (headers: x-anthropic-key)
      - Server: validate API key -> start PipelineOrchestrator async
      - Client: close modal -> show toast "Task created, pipeline starting..."
```

**Error States**:

| Condition | Error Message | HTTP Status |
|-----------|--------------|-------------|
| Empty title | "Title is required" | 400 (client-side) |
| Title > 200 chars | "Title must be 200 characters or fewer" | 400 (client-side) |
| Description > 5000 chars | "Description must be 5000 characters or fewer" | 400 (client-side) |
| Missing category | "Category is required" | 400 (client-side) |
| Missing priority | "Priority is required" | 400 (client-side) |
| Project task limit reached | "Project has reached the maximum of 100 tasks" | 400 |
| Missing API key (Create & Start) | "API key required. Configure your Anthropic API key in Settings." | N/A (client-side block) |
| Invalid API key (Create & Start) | "API key invalid -- please update in Settings" | 401 |
| Server error | "Something went wrong. Please try again." | 500 |

---

## 2. View Kanban Board

**Trigger**: User navigates to `/board` (dashboard default page)

```
Client (KanbanBoard page)
  |
  [1] Read projectStore.activeProjectId
      - If null: show project selection prompt (should not happen after UOW-02 setup)
  |
  [2] taskStore.fetchTasks(activeProjectId)
      - GET /api/tasks?projectId={activeProjectId}
      - Server: validate session -> validate project ownership -> query tasks ordered by updatedAt DESC
      - Return Task[]
  |
  [3] While loading: render KanbanBoardSkeleton (5 column skeletons + card placeholders)
  |
  [4] On data arrival:
      - taskStore.tasks = response data
      - Group tasks by status using taskStore.getTasksByStatus(status)
      - Render 5 KanbanColumns:
        Column 1: Backlog  (status = "backlog")
        Column 2: Spec     (status = "spec")
        Column 3: Building (status = "building")
        Column 4: Review   (status = "review")
        Column 5: Done     (status = "done")
  |
  [5] Each column renders:
      - Column header: name + task count badge
      - List of TaskCard components
      - Empty placeholder if column has no tasks
  |
  [6] If board has zero tasks across all columns:
      - Render EmptyBoardState instead of columns
```

**API Call**:

```
GET /api/tasks?projectId={id}

Response 200:
{
  tasks: Task[]
}

Headers required: session cookie (auth middleware)
```

---

## 3. Drag-and-Drop (Status Transition)

**Trigger**: User drags a TaskCard from one KanbanColumn to another

```
Client (KanbanBoard with DndContext)
  |
  [1] DndContext onDragStart:
      - Set dragging state (taskId, sourceColumn)
      - Apply visual "lifted" style to dragged card (opacity, scale, shadow)
  |
  [2] DndContext onDragOver:
      - Detect target column (useDroppable)
      - Show drop placeholder in target column
      - Highlight target column header
  |
  [3] DndContext onDragEnd:
      - Read final drop target column
      - If same column: no-op, reset drag state
      - If different column:
        [a] Check BR-03-007 (active pipeline restriction)
            - If task has active pipeline AND target is NOT "backlog": reject, show toast
        [b] Optimistic update:
            - taskStore.moveTask(taskId, newStatus)
            - Immediately re-render card in new column
        [c] PATCH /api/tasks/[id] { status: newStatus }
            - Server: validate ownership -> validate transition -> update Task.status + Task.updatedAt
        [d] On success: no additional action (already moved)
        [e] On failure:
            - taskStore.moveTask(taskId, previousStatus)  // rollback
            - Show error toast: "Failed to move task. Reverted."
  |
  [4] DndContext onDragCancel:
      - Reset drag state
      - Card returns to original position with spring animation
```

**Keyboard DnD Support**:

```
[1] Tab to focus a TaskCard
[2] Space/Enter to pick up card
[3] Arrow keys to move between columns
[4] Space/Enter to drop
[5] Escape to cancel
```

**Optimistic Update Flow**:

```
┌─────────────────────────────────────────────┐
│ User drops card                             │
│   |                                         │
│   ├─> UI immediately moves card (optimistic)│
│   |                                         │
│   ├─> PATCH /api/tasks/[id]                 │
│   |     |                                   │
│   |     ├─ 200 OK: done                     │
│   |     |                                   │
│   |     └─ Error: rollback card position    │
│   |               show error toast          │
└─────────────────────────────────────────────┘
```

**Error States**:

| Condition | Error Message | HTTP Status |
|-----------|--------------|-------------|
| Active pipeline blocking drag | "Cannot move task with an active pipeline" | N/A (client-side) |
| Task not found | "Task not found" | 404 |
| Unauthorized | Redirect to /login | 401 |
| Server error | "Failed to move task. Reverted." | 500 |

---

## 4. Task Card Display

**Trigger**: KanbanColumn renders TaskCard for each task in its list

```
TaskCard receives Task object
  |
  [1] Render title (truncated to 2 lines with CSS line-clamp)
  |
  [2] PhaseIndicator:
      - Read task.pipelineState.phase
      - Map phase to color:
        idle/null  -> gray ring (#6B7280)
        planning   -> amber ring (#F59E0B)
        coding     -> blue ring (#3B82F6)
        reviewing  -> purple ring (#8B5CF6)
        completed  -> green ring (#22C55E)
      - Framer Motion: scale + opacity animation on phase change
  |
  [3] PulseDot:
      - Visible only when task.pipelineState?.isActive === true
      - CSS keyframe animation: scale 1 -> 1.5 -> 1, opacity 1 -> 0.5 -> 1
      - Duration: 1.5s infinite
      - Color matches PhaseIndicator color
  |
  [4] CategoryBadge:
      - Render colored chip per category:
        feature      -> blue-100/blue-700
        bug-fix      -> red-100/red-700
        refactoring  -> yellow-100/yellow-700
        performance  -> green-100/green-700
        security     -> purple-100/purple-700
        ui-ux        -> pink-100/pink-700
  |
  [5] Subtask count:
      - If task.subtasks exists and length > 0:
        Count completed vs total: "3/5"
        Show with CheckSquare icon
      - If no subtasks: hidden
  |
  [6] Timestamp:
      - Display relative time: "2h ago", "3d ago"
      - Hover tooltip shows absolute: "Feb 26, 2026 at 14:32"
      - Based on task.updatedAt
  |
  [7] Context menu (right-click or three-dot icon):
      - "Delete" -> triggers delete confirmation flow (process 7)
```

---

## 5. Auto-Animate on Pipeline Progress

**Trigger**: SSE pushes `task-status` event when PipelineOrchestrator transitions a task's status

```
SSE Event Stream (via useSSE hook)
  |
  [1] SSE event type: "task-status"
      Data: { taskId, newStatus, timestamp }
  |
  [2] useSSE hook dispatches to taskStore:
      taskStore.updateTaskStatus(taskId, newStatus)
  |
  [3] taskStore updates the task in tasks[]:
      - Find task by id
      - Set task.status = newStatus
      - Set task.updatedAt = timestamp
  |
  [4] React re-render triggers:
      - getTasksByStatus() returns updated groupings
      - Framer Motion AnimatePresence on KanbanColumn detects:
        - Card removed from source column (exit animation: fade + slide left)
        - Card added to target column (enter animation: fade + slide right)
  |
  [5] SSE event type: "phase-change"
      Data: { phase, status, iteration, timestamp }
  |
  [6] useSSE hook dispatches to taskStore:
      taskStore.updatePipelineState(taskId, { phase, isActive: status === "running", iteration })
  |
  [7] TaskCard re-renders:
      - PhaseIndicator updates color
      - PulseDot visibility toggles
      - Subtask count updates (if Planner just completed)
```

**Animation Timeline for Column Transition**:

```
t=0ms    SSE event received
t=0ms    taskStore updated (synchronous)
t=0ms    Card begins exit animation in source column (200ms duration)
t=200ms  Card fully removed from source column
t=200ms  Card begins enter animation in target column (300ms duration)
t=500ms  Card fully placed in target column
```

---

## 6. Task Detail View

**Trigger**: User clicks a TaskCard on the Kanban board

```
Client (TaskCard onClick)
  |
  [1] router.push(`/task/${task.id}`)
  |
  [2] TaskDetailView page loads (src/app/(dashboard)/task/[id]/page.tsx)
  |
  [3] Fetch task data:
      - GET /api/tasks/[id]
      - Server: validate session -> validate ownership via project -> return full Task with relations
  |
  [4] Render layout:
      ┌──────────────────────────────────────────┐
      │ [< Back to Board]              [Actions] │
      │                                          │
      │ Task Title                    Priority    │
      │ Category Badge    Status Badge            │
      │                                          │
      │ ┌──────────────────────────────────────┐ │
      │ │ Pipeline Visualization (UOW-05 slot) │ │
      │ └──────────────────────────────────────┘ │
      │                                          │
      │ Description                              │
      │ ┌──────────────────────────────────────┐ │
      │ │ Subtask list (if exists)             │ │
      │ └──────────────────────────────────────┘ │
      │                                          │
      │ ┌──────────────────────────────────────┐ │
      │ │ Diff Review Panel (UOW-06 slot)      │ │
      │ └──────────────────────────────────────┘ │
      └──────────────────────────────────────────┘
  |
  [5] UOW-05 slot: empty placeholder in UOW-03
      - "Pipeline visualization will appear here when a pipeline runs."
  |
  [6] UOW-06 slot: empty placeholder in UOW-03
      - "Code diff will appear here after pipeline completion."
  |
  [7] Back navigation:
      - Click back button or press browser back
      - router.back() returns to /board
      - Board scroll position preserved via layout (no full page remount)
```

**Error States**:

| Condition | Error Message | HTTP Status |
|-----------|--------------|-------------|
| Task not found | "Task not found" -> redirect to /board | 404 |
| Not authorized (wrong project) | "Task not found" (same as above) | 404 |
| Server error | "Failed to load task details" | 500 |

---

## 7. Delete Task

**Trigger**: User selects "Delete" from TaskCard context menu

```
Client (TaskCard context menu)
  |
  [1] Show confirmation dialog:
      "Delete task '[title]'? This action cannot be undone."
      [Cancel] [Delete]
  |
  [2] On confirm:
      - Optimistic: taskStore.removeTask(taskId) -> card removed from board
      - DELETE /api/tasks/[id]
      - Server: validate session -> validate ownership -> delete Task (cascade deletes PipelineRun records)
  |
  [3] On success:
      - Show toast: "Task deleted"
  |
  [4] On failure:
      - Rollback: taskStore.addTask(previousTask)
      - Show error toast: "Failed to delete task"
```

**Pre-condition**: If task has an active pipeline, the delete action is still allowed but the pipeline will be terminated server-side (PipelineOrchestrator.cancel called before delete).

---

## 8. Empty States

### Empty Board (zero tasks in project)

```
EmptyBoardState
  |
  [1] Render centered layout:
      - Illustration (abstract Kanban board graphic or Lucide ClipboardList icon, large)
      - Heading: "No tasks yet"
      - Subtext: "Create your first task to get started with AI-powered development."
      - CTA Button: "Create your first task" -> opens TaskCreationModal
  |
  [2] Replaces the entire KanbanBoard when taskStore.tasks.length === 0
```

### Empty Column (specific column has zero tasks)

```
EmptyColumnState
  |
  [1] Render subtle placeholder within column:
      - Dashed border container (min-height: 120px)
      - Muted text per column:
        Backlog:  "Drop tasks here or create a new one"
        Spec:     "Tasks move here during planning"
        Building: "Tasks move here during coding"
        Review:   "Tasks move here for review"
        Done:     "Completed tasks appear here"
  |
  [2] Acts as a valid drop target for dnd-kit (useDroppable)
```

---

## 9. taskStore (Zustand)

```
Purpose: Manage all task state for the active project

State:
  - tasks: Task[]                    // All tasks for active project
  - isLoading: boolean               // True during fetchTasks
  - error: string | null             // Last error message
  - filter: {                        // Active filters (US-023)
      search: string;
      category: TaskCategory | null;
      priority: TaskPriority | null;
    }

Computed (via selectors):
  - getTasksByStatus(status: TaskStatus): Task[]
    Filter tasks[] by status, apply search/category/priority filters, sort by updatedAt DESC

Actions:
  - fetchTasks(projectId: string): Promise<void>
    GET /api/tasks?projectId={id} -> set tasks[], isLoading, error

  - createTask(data: CreateTaskInput): Promise<Task>
    POST /api/tasks -> add to tasks[] -> return created task

  - updateTask(id: string, data: Partial<Task>): Promise<void>
    PATCH /api/tasks/[id] -> update task in tasks[]

  - deleteTask(id: string): Promise<void>
    DELETE /api/tasks/[id] -> remove from tasks[]

  - moveTask(id: string, newStatus: TaskStatus): void
    Synchronous: update task.status in tasks[] (optimistic)
    Used by both DnD and SSE auto-move

  - updateTaskStatus(id: string, newStatus: TaskStatus): void
    Alias for moveTask, used by SSE event handler

  - updatePipelineState(id: string, state: PipelineState): void
    Update task.pipelineState in tasks[]
    Triggers PhaseIndicator + PulseDot re-render

  - setFilter(filter: Partial<FilterState>): void
    Update filter state, triggering re-render of filtered task lists

  - clearFilters(): void
    Reset filter to defaults

  - reset(): void
    Clear all tasks and reset state (called on project switch)

Lifecycle:
  - fetchTasks() called when:
    - Board page mounts
    - projectStore.activeProjectId changes
    - After successful task creation (optional, could rely on addTask)
  - reset() called when:
    - User switches project (projectStore.activeProjectId changes)
    - User logs out
  - moveTask() called from:
    - DnD onDragEnd handler
    - SSE task-status event handler
  - updatePipelineState() called from:
    - SSE phase-change event handler
```

---

## Process-to-Story Traceability

| Business Process | Stories Covered |
|-----------------|----------------|
| Create Task (Modal) | US-012, US-013, US-014, US-015, US-016 |
| View Kanban Board | US-017, US-024 |
| Drag-and-Drop | US-018 |
| Task Card Display | US-020 |
| Auto-Animate on Pipeline | US-019 |
| Task Detail View | US-021 |
| Delete Task | (infrastructure, supports task lifecycle) |
| Empty State | US-022 |
| taskStore | (infrastructure, supports all stories) |
| Filter and Search | US-023 |
