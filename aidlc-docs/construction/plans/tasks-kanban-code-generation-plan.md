# Code Generation Plan -- UOW-03: Tasks & Kanban Board

## Overview

This plan defines every code generation step for UOW-03 (Tasks & Kanban Board) of the AutoCoder project. Each step produces one or more files, lists its story traceability, business rule enforcement, `data-testid` attributes for interactive elements, and testing notes.

**Unit**: UOW-03 -- Tasks & Kanban Board
**Stories**: US-012 through US-024 (13 stories: 10 Must, 3 Should)
**Dependencies**: UOW-01 (auth, layout, Prisma schema stub, authStore, uiStore), UOW-02 (projectStore, ProjectService, Project model)
**New Dependencies**: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`

---

## Pre-Implementation Checklist

- [ ] Verify UOW-01 is merged: auth middleware, AppShell, uiStore, Prisma client singleton, shadcn/ui base components
- [ ] Verify UOW-02 is merged: projectStore with `activeProjectId`, ProjectService with ownership checks
- [ ] Install dnd-kit packages: `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`
- [ ] Verify shadcn/ui components available: Dialog, Button, Input, Textarea, Select, Badge, Tooltip, DropdownMenu, AlertDialog, Skeleton, Separator, ScrollArea, Sonner (toast). Add any missing via `npx shadcn@latest add <component>`

---

## Step 1: Extend Prisma Schema (Task Model)

- [ ] **1.1** Add Task model to `prisma/schema.prisma`

**File**: `prisma/schema.prisma`

**Action**: Add the following model below the existing Project model:

```prisma
model Task {
  id            String       @id @default(cuid())
  title         String       @db.VarChar(200)
  description   String?      @db.Text
  category      String       @default("feature")
  priority      String       @default("medium")
  status        String       @default("backlog")
  pipelineState Json?
  subtasks      Json?
  projectId     String
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  project       Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  pipelineRuns  PipelineRun[]

  @@index([projectId, status])
  @@index([projectId, createdAt])
  @@map("task")
}
```

- [ ] **1.2** Add `tasks Task[]` relation field to the existing `Project` model
- [ ] **1.3** Add a stub `PipelineRun` model so the relation compiles (will be fully expanded in UOW-04):

```prisma
model PipelineRun {
  id          String   @id @default(cuid())
  taskId      String
  phase       String
  iteration   Int      @default(1)
  status      String   @default("pending")
  startedAt   DateTime @default(now())
  completedAt DateTime?

  task        Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)

  @@index([taskId])
  @@map("pipeline_run")
}
```

- [ ] **1.4** Run `npx prisma migrate dev --name add-task-model` to generate and apply migration
- [ ] **1.5** Run `npx prisma generate` to regenerate Prisma client types

**Stories**: Infrastructure (supports all US-012 -- US-024)
**Business Rules**: BR-03-001 (VarChar 200), BR-03-002 (Text), BR-03-003 (category default), BR-03-004 (priority default), BR-03-009 (limit enforced at service layer)
**Testing Notes**: Verify migration runs cleanly. Inspect generated migration SQL for correct column types, indexes, and cascade deletes.

---

## Step 2: Type Definitions

- [ ] **2.1** Create `src/types/task.ts` with full type definitions

**File**: `src/types/task.ts`

**Contents**:

```ts
// --- Enum Constants ---

export const TASK_CATEGORIES = [
  "feature",
  "bug-fix",
  "refactoring",
  "performance",
  "security",
  "ui-ux",
] as const;

export type TaskCategory = (typeof TASK_CATEGORIES)[number];

export const TASK_PRIORITIES = ["low", "medium", "high", "critical"] as const;

export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_STATUSES = [
  "backlog",
  "spec",
  "building",
  "review",
  "done",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

// --- Display Label Mappings ---

export const CATEGORY_LABELS: Record<TaskCategory, string> = {
  feature: "Feature",
  "bug-fix": "Bug Fix",
  refactoring: "Refactoring",
  performance: "Performance",
  security: "Security",
  "ui-ux": "UI/UX",
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  spec: "Spec",
  building: "Building",
  review: "Review",
  done: "Done",
};

// --- Kanban Column Configuration ---

export const KANBAN_COLUMNS: {
  status: TaskStatus;
  label: string;
  emptyText: string;
}[] = [
  { status: "backlog", label: "Backlog", emptyText: "Drop tasks here or create a new one" },
  { status: "spec", label: "Spec", emptyText: "Tasks move here during planning" },
  { status: "building", label: "Building", emptyText: "Tasks move here during coding" },
  { status: "review", label: "Review", emptyText: "Tasks move here for review" },
  { status: "done", label: "Done", emptyText: "Completed tasks appear here" },
];

// --- JSON Field Types ---

export type SubtaskStatus = "pending" | "in-progress" | "completed" | "failed";

export interface Subtask {
  id: string;
  title: string;
  description?: string;
  status: SubtaskStatus;
  order: number;
}

export type PipelinePhase =
  | "planning"
  | "coding"
  | "reviewing"
  | "fixing"
  | "completed"
  | "failed";

export interface PipelineState {
  phase: PipelinePhase;
  iteration: number;
  isActive: boolean;
  startedAt?: string;
  completedAt?: string;
  failureReason?: string;
}

// --- Phase Color Mapping ---

export const PHASE_COLORS: Record<PipelinePhase | "idle", string> = {
  idle: "#6B7280",
  planning: "#F59E0B",
  coding: "#3B82F6",
  reviewing: "#8B5CF6",
  fixing: "#3B82F6",
  completed: "#22C55E",
  failed: "#EF4444",
};

// --- Core Entity ---

export interface Task {
  id: string;
  title: string;
  description: string | null;
  category: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;
  pipelineState: PipelineState | null;
  subtasks: Subtask[] | null;
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

// --- API Input Types ---

export interface CreateTaskInput {
  title: string;
  description?: string;
  category: TaskCategory;
  priority: TaskPriority;
  projectId: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  category?: TaskCategory;
  priority?: TaskPriority;
  status?: TaskStatus;
}

// --- Filter Types ---

export interface TaskFilter {
  search: string;
  category: TaskCategory | null;
  priority: TaskPriority | null;
}

// --- Category Badge Colors ---

export const CATEGORY_BADGE_COLORS: Record<
  TaskCategory,
  { bg: string; text: string }
> = {
  feature: { bg: "bg-blue-100", text: "text-blue-700" },
  "bug-fix": { bg: "bg-red-100", text: "text-red-700" },
  refactoring: { bg: "bg-yellow-100", text: "text-yellow-700" },
  performance: { bg: "bg-green-100", text: "text-green-700" },
  security: { bg: "bg-purple-100", text: "text-purple-700" },
  "ui-ux": { bg: "bg-pink-100", text: "text-pink-700" },
};
```

**Stories**: Infrastructure (supports US-013, US-017, US-020, US-023)
**Business Rules**: BR-03-003 (category enum), BR-03-004 (priority enum), BR-03-010 (phase colors), BR-03-012 (timestamp types)
**Testing Notes**: Import types in a test file and verify all enum arrays contain expected values. Verify `PHASE_COLORS` covers all `PipelinePhase` values plus `"idle"`.

---

## Step 3: Zod Validators

- [ ] **3.1** Create `src/lib/validators/task.ts` (or `src/lib/validations/task-schemas.ts` per domain-entities doc)

**File**: `src/lib/validators/task.ts`

**Contents**:

```ts
import { z } from "zod";
import { TASK_CATEGORIES, TASK_PRIORITIES, TASK_STATUSES } from "@/types/task";

export const createTaskSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be 200 characters or fewer")
    .trim(),
  description: z
    .string()
    .max(5000, "Description must be 5000 characters or fewer")
    .optional()
    .or(z.literal("")),
  category: z.enum(TASK_CATEGORIES, {
    required_error: "Category is required",
  }),
  priority: z.enum(TASK_PRIORITIES, {
    required_error: "Priority is required",
  }),
  projectId: z.string().min(1, "Project ID is required"),
});

export const updateTaskSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be 200 characters or fewer")
    .trim()
    .optional(),
  description: z
    .string()
    .max(5000, "Description must be 5000 characters or fewer")
    .nullable()
    .optional(),
  category: z.enum(TASK_CATEGORIES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  status: z.enum(TASK_STATUSES).optional(),
});

export const moveTaskSchema = z.object({
  status: z.enum(TASK_STATUSES, {
    required_error: "Status is required",
  }),
});

export const taskQuerySchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  status: z.enum(TASK_STATUSES).optional(),
  category: z.enum(TASK_CATEGORIES).optional(),
  search: z.string().optional(),
});

export type CreateTaskSchema = z.infer<typeof createTaskSchema>;
export type UpdateTaskSchema = z.infer<typeof updateTaskSchema>;
export type MoveTaskSchema = z.infer<typeof moveTaskSchema>;
export type TaskQuerySchema = z.infer<typeof taskQuerySchema>;
```

**Stories**: US-014 (Form Validation)
**Business Rules**: BR-03-001 (title 1-200 chars, trimmed), BR-03-002 (description max 5000, optional), BR-03-003 (category enum), BR-03-004 (priority enum)
**NFR**: NFR-03-006 (Zod shared client/server validation)
**Testing Notes**: Unit test each schema with valid and invalid inputs. Test edge cases: empty string title, 200-char title, 201-char title, special characters, SQL injection strings, XSS payloads. Verify trim behavior.

---

## Step 4: Task Store (Zustand)

- [ ] **4.1** Create `src/stores/task-store.ts`

**File**: `src/stores/task-store.ts`

**Implementation Details**:

```ts
// State shape:
interface TaskState {
  tasks: Task[];
  isLoading: boolean;
  error: string | null;
  filter: TaskFilter;
}

// Actions:
interface TaskActions {
  fetchTasks: (projectId: string) => Promise<void>;
  createTask: (data: CreateTaskInput) => Promise<Task>;
  updateTask: (id: string, data: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  moveTask: (id: string, newStatus: TaskStatus) => void;           // Synchronous optimistic
  updateTaskStatus: (id: string, newStatus: TaskStatus) => void;   // Alias for SSE
  updatePipelineState: (id: string, state: PipelineState) => void; // SSE phase-change
  setFilter: (filter: Partial<TaskFilter>) => void;
  clearFilters: () => void;
  reset: () => void;
}

// Selectors (computed):
// getTasksByStatus(status: TaskStatus): Task[]
//   - Filters tasks[] by status
//   - Applies search filter (case-insensitive match on title + description)
//   - Applies category filter
//   - Applies priority filter
//   - Sorts by updatedAt DESC
```

**Key Implementation Requirements**:
- `moveTask` must be synchronous (no async/await) for optimistic DnD updates
- `fetchTasks` sets `isLoading = true` before fetch, `false` after, and captures errors
- `deleteTask` uses optimistic removal: remove from array immediately, rollback on API error
- `createTask` adds returned task to `tasks[]` immediately after successful POST
- `reset()` clears tasks array and resets filter; called on project switch or logout
- `getTasksByStatus` must be a function (not a Zustand selector with `useShallow`) because it takes a parameter

**data-testid attributes**: N/A (store has no DOM)

**Stories**: Infrastructure (supports all US-012 -- US-024)
**Business Rules**: BR-03-005 (tasks scoped to project via `fetchTasks(projectId)`), BR-03-007 (active pipeline guard -- checked at component level, not store level)
**NFR**: NFR-03-002 (optimistic moveTask < 100ms), NFR-03-011 (rollback on failure)
**Testing Notes**: Unit test all actions. Test optimistic update + rollback flow: mock API failure, call moveTask, verify state updates, verify rollback restores previous status. Test filter combinations. Test `reset()` clears everything.

---

## Step 5: Task API Routes

- [ ] **5.1** Create `src/app/api/tasks/route.ts` (GET list, POST create)

**File**: `src/app/api/tasks/route.ts`

**GET /api/tasks**:
```
Query params: projectId (required), status (optional), category (optional), search (optional)
Logic:
  1. Validate session (auth middleware)
  2. Parse + validate query params with taskQuerySchema
  3. Verify project ownership: project.userId === session.userId (return 404 if not)
  4. Query tasks: prisma.task.findMany({ where: { projectId, ...filters }, orderBy: { updatedAt: "desc" } })
  5. Return { tasks: Task[] }
```

**POST /api/tasks**:
```
Body: { title, description, category, priority, projectId }
Logic:
  1. Validate session
  2. Parse + validate body with createTaskSchema
  3. Verify project ownership (404 if not)
  4. Check task count: prisma.task.count({ where: { projectId } }) -- reject if >= 100 (BR-03-009)
  5. Create task: prisma.task.create({ data: { ...validated, status: "backlog" } })
  6. Return created task (201)
```

- [ ] **5.2** Create `src/app/api/tasks/[id]/route.ts` (GET detail, PATCH update, DELETE)

**File**: `src/app/api/tasks/[id]/route.ts`

**GET /api/tasks/[id]**:
```
Logic:
  1. Validate session
  2. Find task by id, include project for ownership check
  3. Verify project.userId === session.userId (404 if not)
  4. Return task
```

**PATCH /api/tasks/[id]**:
```
Body: any subset of { title, description, category, priority, status }
Logic:
  1. Validate session
  2. Parse + validate body with updateTaskSchema
  3. Find task, verify ownership chain (user -> project -> task)
  4. Update task fields + set updatedAt
  5. Return updated task
```

**DELETE /api/tasks/[id]**:
```
Logic:
  1. Validate session
  2. Find task, verify ownership chain
  3. Delete task (cascade deletes PipelineRun records)
  4. Return 204 No Content
```

- [ ] **5.3** Create `src/app/api/tasks/[id]/move/route.ts` (PATCH move -- status + position)

**File**: `src/app/api/tasks/[id]/move/route.ts`

**PATCH /api/tasks/[id]/move**:
```
Body: { status: TaskStatus }
Logic:
  1. Validate session
  2. Parse body with moveTaskSchema
  3. Find task, verify ownership chain
  4. Update task.status and task.updatedAt
  5. Return updated task
```

**data-testid attributes**: N/A (API routes have no DOM)

**Stories**: US-012 (POST create), US-016 (POST create without pipeline), US-017 (GET list), US-018 (PATCH move), US-021 (GET detail)
**Business Rules**: BR-03-001 -- BR-03-004 (input validation), BR-03-005 (ownership enforcement), BR-03-006 (status transitions), BR-03-009 (100 task limit)
**NFR**: NFR-03-005 (two-layer ownership check), NFR-03-006 (Zod server-side validation), NFR-03-012 (task limit enforcement)
**Testing Notes**:
- Test GET with valid/invalid projectId, unauthorized user, empty project
- Test POST with all valid fields, missing required fields, boundary lengths (200 char title, 5000 char description), 100th task limit
- Test PATCH with partial updates, invalid enum values, non-existent task ID
- Test DELETE with valid task, non-existent task, task owned by different user
- Test move endpoint with all valid status transitions
- Verify all unauthorized requests return 404 (not 403, to prevent ownership leakage)

---

## Step 6: KanbanBoard & KanbanColumn

- [ ] **6.1** Create `src/components/board/kanban-board.tsx`

**File**: `src/components/board/kanban-board.tsx`

**Implementation Details**:
- `"use client"` directive
- Reads from `taskStore` and `projectStore`
- Wraps columns in `DndContext` from `@dnd-kit/core`
- Configures sensors: `PointerSensor` (distance: 8px activation), `KeyboardSensor` (sortableKeyboardCoordinates), `TouchSensor` (delay: 250ms, tolerance: 5px)
- Collision detection: `closestCorners`
- Renders `SortableContext` with `KANBAN_COLUMNS` map
- Renders `DragOverlay` with `TaskCard` when `activeId` is set
- Includes `TaskFilterBar` above columns
- Event handlers:
  - `handleDragStart`: set `activeId`, add body class `is-dragging`
  - `handleDragOver`: set `overId` for column highlight
  - `handleDragEnd`: extract target column from droppable ID; check BR-03-007 (active pipeline guard); call `taskStore.moveTask()` optimistically; fire `PATCH /api/tasks/[id]/move`; rollback + error toast on failure
  - `handleDragCancel`: reset `activeId` and `overId`

**data-testid attributes**:
| Element | data-testid |
|---------|-------------|
| Board container | `kanban-board` |
| Drag overlay | `drag-overlay` |

**Stories**: US-017 (View Kanban Board), US-018 (Drag Task Between Columns), US-019 (Auto-Move on Pipeline Progress -- store subscription)
**Business Rules**: BR-03-005 (scoped to active project), BR-03-006 (all manual transitions allowed), BR-03-007 (active pipeline drag restriction)
**NFR**: NFR-03-001 (render < 500ms for 100 tasks), NFR-03-002 (DnD response < 100ms), NFR-03-003 (60fps animations), NFR-03-008 (keyboard DnD), NFR-03-009 (touch DnD 250ms delay)
**Testing Notes**: Test drag from one column to another. Test drag of task with active pipeline (should reject unless target is backlog). Test keyboard DnD flow (Tab -> Space -> Arrow -> Space). Test that optimistic update applies before API response.

- [ ] **6.2** Create `src/components/board/kanban-column.tsx`

**File**: `src/components/board/kanban-column.tsx`

**Implementation Details**:
- `"use client"` directive
- Props: `{ status: TaskStatus }`
- Uses `useDroppable({ id: status })` from `@dnd-kit/core`
- Reads `taskStore.getTasksByStatus(status)` for filtered task list
- Renders column header: column label from `KANBAN_COLUMNS` + task count `Badge`
- Wraps task list in `AnimatePresence` (Framer Motion) with `mode="popLayout"`
- Each task wrapped in `motion.div` with `layout`, `initial`, `animate`, `exit` props
- Spring transition: `{ type: "spring", stiffness: 300, damping: 30 }`
- When column is empty: render `EmptyColumnState` with column-specific text
- Drop highlight: apply `ring-2 ring-primary/20 bg-primary/5` when `isOver` is true
- ScrollArea for overflow-y on task list
- Column styling: `flex-1`, `min-w-[240px]`, `bg-muted/5`, `rounded-lg`

**data-testid attributes**:
| Element | data-testid |
|---------|-------------|
| Column container | `kanban-column-{status}` (e.g., `kanban-column-backlog`) |
| Column header | `column-header-{status}` |
| Task count badge | `task-count-{status}` |
| Task list area | `task-list-{status}` |

**Stories**: US-017 (View Kanban Board), US-018 (Drag target), US-022 (Empty column state)
**Business Rules**: BR-03-006 (each column represents a valid status)
**Testing Notes**: Test column renders correct tasks. Test empty column shows placeholder. Test drop highlight appears on drag-over. Test AnimatePresence enter/exit animations fire.

---

## Step 7: TaskCard with Sub-Components

- [ ] **7.1** Create `src/components/board/task-card.tsx`

**File**: `src/components/board/task-card.tsx`

**Implementation Details**:
- `"use client"` directive
- Props: `{ task: Task; isDragOverlay?: boolean }`
- Uses `useDraggable({ id: task.id })` from `@dnd-kit/core`
- Entire card is drag handle (spread `listeners` and `attributes`)
- Ghost effect: `opacity: 0.5` when `isDragging` is true (original position)
- Overlay style: elevated shadow + `scale(1.02)` when `isDragOverlay`
- Click handler: `router.push(\`/task/${task.id}\`)` (only fires if not dragging)
- Title: truncated to 2 lines via CSS `line-clamp-2`
- Renders sub-components: `PhaseIndicator`, `PulseDot`, `CategoryBadge`
- Subtask count: `CheckSquare` icon + "completed/total" (hidden if no subtasks)
- Timestamp: relative time (e.g., "2h ago") with `Tooltip` for absolute format
- Context menu: `DropdownMenu` with `MoreVertical` icon trigger; "Delete" option
- Delete flow: `AlertDialog` confirmation -> optimistic `taskStore.deleteTask()` -> `DELETE /api/tasks/[id]` -> rollback on failure
- Framer Motion: `whileHover={{ y: -2 }}`, `whileTap={{ scale: 0.98 }}`
- Card styling: `bg-card`, `border`, `rounded-lg`, `shadow-sm`, `hover:shadow-md`, `p-3`, `cursor-grab` / `cursor-grabbing`

**data-testid attributes**:
| Element | data-testid |
|---------|-------------|
| Card container | `task-card-{task.id}` |
| Card title | `task-card-title-{task.id}` |
| Subtask count | `task-subtask-count-{task.id}` |
| Timestamp | `task-timestamp-{task.id}` |
| Context menu trigger | `task-menu-{task.id}` |
| Delete menu item | `task-delete-{task.id}` |
| Delete confirm button | `task-delete-confirm-{task.id}` |
| Delete cancel button | `task-delete-cancel-{task.id}` |

**Stories**: US-020 (Task Card Details Display), US-021 (Click to open detail)
**Business Rules**: BR-03-010 (phase indicator), BR-03-011 (pulse dot), BR-03-012 (timestamp format)
**Testing Notes**: Test card renders all fields. Test click navigates to detail. Test context menu opens. Test delete flow with confirmation. Test drag attributes are applied. Test ghost effect on drag.

- [ ] **7.2** Create `src/components/board/phase-indicator.tsx`

**File**: `src/components/board/phase-indicator.tsx`

**Implementation Details**:
- Props: `{ phase: PipelinePhase | null; size?: "sm" | "md" }`
- Derives color from `PHASE_COLORS[phase ?? "idle"]`
- Renders circular div with `border-2` and dynamic `borderColor`
- Size: `sm` = 12px (w-3 h-3), `md` = 20px (w-5 h-5)
- Framer Motion: animate `borderColor` and `scale: [1, 1.1, 1]` on phase change (500ms)

**data-testid attributes**:
| Element | data-testid |
|---------|-------------|
| Indicator dot | `phase-indicator` |

**Stories**: US-020
**Business Rules**: BR-03-010 (phase color mapping)
**Testing Notes**: Test all 7 phase values (idle + 6 phases) render correct border color. Test size prop changes dimensions.

- [ ] **7.3** Create `src/components/board/pulse-dot.tsx`

**File**: `src/components/board/pulse-dot.tsx`

**Implementation Details**:
- Props: `{ isActive: boolean; color: string }`
- Returns `null` when `!isActive`
- Renders relative span containing:
  - Outer span: absolute, `animate-ping`, `rounded-full`, `opacity-75`, dynamic `backgroundColor`
  - Inner span: relative, `w-2.5 h-2.5`, `rounded-full`, dynamic `backgroundColor`

**data-testid attributes**:
| Element | data-testid |
|---------|-------------|
| Pulse dot container | `pulse-dot` |

**Stories**: US-020
**Business Rules**: BR-03-011 (visible only when pipeline isActive)
**Testing Notes**: Test renders when `isActive=true`. Test returns null when `isActive=false`. Test color prop is applied to both spans.

- [ ] **7.4** Create `src/components/board/category-badge.tsx`

**File**: `src/components/board/category-badge.tsx`

**Implementation Details**:
- Props: `{ category: TaskCategory; size?: "sm" | "md" }`
- Reads `CATEGORY_BADGE_COLORS[category]` for bg/text classes
- Reads `CATEGORY_LABELS[category]` for display text
- Renders span with `rounded-full px-2 py-0.5 text-xs font-medium` + dynamic bg/text classes
- Size `md`: larger padding and text-sm

**data-testid attributes**:
| Element | data-testid |
|---------|-------------|
| Badge element | `category-badge-{category}` |

**Stories**: US-020
**Business Rules**: BR-03-003 (category values)
**Testing Notes**: Test all 6 category values render correct label and color classes.

---

## Step 8: TaskCreationModal

- [ ] **8.1** Create `src/components/board/task-creation-modal.tsx`

**File**: `src/components/board/task-creation-modal.tsx`

**Implementation Details**:
- `"use client"` directive
- Uses shadcn/ui `Dialog`, `DialogContent`, `DialogHeader`, `DialogFooter`
- Open/close controlled by `uiStore.isTaskModalOpen` / `uiStore.closeTaskModal()`
- Internal state: `title`, `description`, `category` (default: `"feature"`), `priority` (default: `"medium"`), `errors` object, `isCreating`, `isStarting`
- Form fields:
  - Title: `Input` with `label="Title *"`, max 200 chars
  - Description: `Textarea` with auto-expand, character counter `{length}/5000`
  - Category: `Select` with 6 options from `TASK_CATEGORIES`
  - Priority: `Select` with 4 options from `TASK_PRIORITIES`
- Validation: runs `createTaskSchema.safeParse()` on submit; displays field-level errors inline below each field
- "Create" button:
  1. Validate form
  2. `POST /api/tasks` with `{ title, description, category, priority, projectId: projectStore.activeProjectId }`
  3. `taskStore.addTask(response.task)` (via `createTask` action)
  4. Close modal
  5. Show success toast: "Task created"
- "Create & Start" button:
  1. Pre-flight: check `localStorage.getItem("ac_api_key")`; if missing, show form error and abort
  2. Same as Create steps 1-3
  3. `POST /api/tasks/[id]/start-pipeline` with `x-anthropic-key` header
  4. Close modal
  5. Show toast: "Task created, pipeline starting..."
- Reset form state on close
- Framer Motion: Dialog entry scale + opacity animation

**data-testid attributes**:
| Element | data-testid |
|---------|-------------|
| Modal dialog | `task-creation-modal` |
| Title input | `task-title-input` |
| Description textarea | `task-description-input` |
| Description char count | `task-description-count` |
| Category select trigger | `task-category-select` |
| Priority select trigger | `task-priority-select` |
| Create button | `task-create-btn` |
| Create & Start button | `task-create-start-btn` |
| Title error | `task-title-error` |
| Description error | `task-description-error` |
| Category error | `task-category-error` |
| Priority error | `task-priority-error` |
| Form-level error | `task-form-error` |

**Stories**: US-012 (Open Modal), US-013 (Fill Form), US-014 (Validation), US-015 (Create & Start), US-016 (Create without pipeline)
**Business Rules**: BR-03-001 (title validation), BR-03-002 (description validation), BR-03-003 (category required), BR-03-004 (priority required), BR-03-008 (API key check for Create & Start), BR-03-009 (task limit -- server returns 400)
**NFR**: NFR-03-006 (client-side Zod validation), NFR-03-007 (API key client-only, header-only)
**Testing Notes**: Test form renders with defaults. Test field validation on submit. Test successful create flow. Test Create & Start with missing API key shows error. Test Create & Start with valid key. Test form resets on close. Test task limit error handling (server 400).

---

## Step 9: TaskDetailView

- [ ] **9.1** Create `src/app/(dashboard)/task/[id]/page.tsx` (page shell)

**File**: `src/app/(dashboard)/task/[id]/page.tsx`

**Implementation Details**:
- Server Component that extracts `id` from route params
- Renders `TaskDetailView` component with `taskId={id}` prop

- [ ] **9.2** Create `src/components/board/task-detail-view.tsx`

**File**: `src/components/board/task-detail-view.tsx`

**Implementation Details**:
- `"use client"` directive
- Props: `{ taskId: string }`
- On mount: check if task exists in `taskStore.tasks` (avoid re-fetch); if not, `GET /api/tasks/[id]`
- Loading state: spinner or skeleton
- Error state: redirect to `/board` with toast "Task not found"
- Layout sections:
  1. Back button: `ArrowLeft` icon + "Back to Board" -> `router.back()` or `router.push("/board")`
  2. Header: title, priority badge, category badge, status label with `PhaseIndicator`
  3. Pipeline visualization slot: placeholder card with text "Pipeline visualization will appear here when a pipeline runs." (UOW-05 fills this)
  4. Description: rendered as text block (or "No description provided" in muted text)
  5. Subtasks list: if `task.subtasks` exists, render ordered list with status icons (checkmark for completed, circle for pending/in-progress, X for failed). Show "completed/total" header.
  6. Diff review slot: placeholder card with text "Code diff will appear here after pipeline completion." (UOW-06 fills this)
  7. Footer: "Created: {absolute date}" and "Updated: {relative time}"
- Framer Motion: page enter `initial={{ opacity: 0, y: 10 }}` `animate={{ opacity: 1, y: 0 }}`

**data-testid attributes**:
| Element | data-testid |
|---------|-------------|
| Detail view container | `task-detail-view` |
| Back button | `task-detail-back-btn` |
| Task title heading | `task-detail-title` |
| Priority badge | `task-detail-priority` |
| Status label | `task-detail-status` |
| Pipeline slot | `task-detail-pipeline-slot` |
| Description section | `task-detail-description` |
| Subtask list | `task-detail-subtasks` |
| Subtask item | `task-detail-subtask-{subtask.id}` |
| Diff slot | `task-detail-diff-slot` |
| Created timestamp | `task-detail-created` |
| Updated timestamp | `task-detail-updated` |

**Stories**: US-021 (Click Card to Open Task Detail)
**Business Rules**: BR-03-005 (ownership enforced server-side on GET)
**Testing Notes**: Test renders task data correctly. Test back button navigates to /board. Test 404 handling redirects to /board. Test placeholder slots render correct text. Test subtask list renders when subtasks exist. Test subtask list hidden when subtasks is null.

---

## Step 10: TaskFilterBar & useTaskFilters Hook

- [ ] **10.1** Create `src/hooks/use-task-filters.ts`

**File**: `src/hooks/use-task-filters.ts`

**Implementation Details**:
- Custom hook that reads `taskStore.filter` and provides:
  - `filter`: current filter state
  - `setSearch(value: string)`: debounced (300ms) update to `taskStore.setFilter({ search })`
  - `setCategory(value: TaskCategory | null)`: update category filter
  - `setPriority(value: TaskPriority | null)`: update priority filter
  - `clearAll()`: `taskStore.clearFilters()`
  - `hasActiveFilters`: boolean -- true if any filter is non-default

**Stories**: US-023 (Filter and Search Tasks)
**Testing Notes**: Test debounce on search. Test filter state changes. Test `hasActiveFilters` logic. Test `clearAll` resets everything.

- [ ] **10.2** Create `src/components/board/task-filter-bar.tsx`

**File**: `src/components/board/task-filter-bar.tsx`

**Implementation Details**:
- `"use client"` directive
- Uses `useTaskFilters` hook
- Layout: horizontal bar above Kanban columns
  - Search input: `Search` icon prefix + `Input` placeholder "Search tasks..."
  - Category dropdown: `Select` with "All Categories" default + 6 category options
  - Priority dropdown: `Select` with "All Priorities" default + 4 priority options
  - Clear button: visible only when `hasActiveFilters`, calls `clearAll()`
  - "+ New Task" button: calls `uiStore.openTaskModal()`
- All filter changes immediately update taskStore, causing column re-renders

**data-testid attributes**:
| Element | data-testid |
|---------|-------------|
| Filter bar container | `task-filter-bar` |
| Search input | `task-search-input` |
| Category filter select | `task-filter-category` |
| Priority filter select | `task-filter-priority` |
| Clear filters button | `task-filter-clear` |
| New task button | `task-new-btn` |

**Stories**: US-023 (Filter and Search Tasks)
**Business Rules**: N/A (client-side filtering only)
**Testing Notes**: Test search filters tasks by title across all columns. Test category filter shows only matching tasks. Test priority filter. Test combined filters. Test clear resets. Test "+ New Task" opens modal.

---

## Step 11: Empty States

- [ ] **11.1** Create `src/components/board/empty-board-state.tsx`

**File**: `src/components/board/empty-board-state.tsx`

**Implementation Details**:
- `"use client"` directive
- Centered layout replacing entire KanbanBoard when `taskStore.tasks.length === 0`
- Content:
  - `ClipboardList` icon (Lucide), 64px, muted color
  - Heading: "No tasks yet" (text-xl font-semibold)
  - Subtext: "Create your first task to get started with AI-powered development." (text-muted-foreground)
  - CTA Button: `Plus` icon + "Create your first task" -> `uiStore.openTaskModal()`
- Framer Motion: fade in `initial={{ opacity: 0 }}` `animate={{ opacity: 1 }}` `transition={{ duration: 0.3 }}`

**data-testid attributes**:
| Element | data-testid |
|---------|-------------|
| Empty board container | `empty-board-state` |
| Create first task button | `empty-board-create-btn` |

**Stories**: US-022 (Empty State)
**Testing Notes**: Test renders when tasks array is empty. Test CTA button opens modal. Test does not render when tasks exist.

- [ ] **11.2** Create `src/components/board/empty-column-state.tsx`

**File**: `src/components/board/empty-column-state.tsx`

**Implementation Details**:
- Props: `{ text: string }`
- Dashed border container with `min-h-[120px]`
- Centered muted text (the column-specific placeholder)
- Acts as valid drop target (parent KanbanColumn's `setNodeRef` covers this area)

**data-testid attributes**:
| Element | data-testid |
|---------|-------------|
| Empty column container | `empty-column-state` |

**Stories**: US-022 (Empty State)
**Testing Notes**: Test renders with provided text. Test accepts drops (integration test with dnd-kit).

---

## Step 12: Loading Skeleton

- [ ] **12.1** Create `src/components/board/kanban-board-skeleton.tsx`

**File**: `src/components/board/kanban-board-skeleton.tsx`

**Implementation Details**:
- Renders 5 skeleton columns in a horizontal flex layout
- Each column contains:
  - Skeleton header bar (column name placeholder)
  - 2-3 skeleton card placeholders of varying heights
- Uses shadcn/ui `Skeleton` component with `animate-pulse`
- Layout matches real KanbanBoard dimensions (same flex-1, min-w, gap)

**data-testid attributes**:
| Element | data-testid |
|---------|-------------|
| Skeleton container | `kanban-board-skeleton` |
| Skeleton column | `skeleton-column-{index}` (0-4) |

**Stories**: US-024 (Loading Skeleton)
**NFR**: NFR-03-010 (5 columns x 3 skeleton cards, immediate render, no blank flash)
**Testing Notes**: Test renders 5 columns. Test each column has skeleton cards. Test animate-pulse class is applied.

---

## Step 13: Update Dashboard Page

- [ ] **13.1** Create `src/app/(dashboard)/board/page.tsx` (Board Page)

**File**: `src/app/(dashboard)/board/page.tsx`

**Implementation Details**:
- `"use client"` directive
- Reads `taskStore.tasks`, `taskStore.isLoading` and `projectStore.activeProjectId`
- `useEffect` triggers `taskStore.fetchTasks(activeProjectId)` on mount and when `activeProjectId` changes
- Conditional rendering:
  1. If `isLoading`: render `KanbanBoardSkeleton`
  2. If `tasks.length === 0` (and not loading): render `EmptyBoardState`
  3. Otherwise: render `TaskFilterBar` + `KanbanBoard` + `TaskCreationModal`
- On `activeProjectId` change: call `taskStore.reset()` then `taskStore.fetchTasks(newProjectId)`

**data-testid attributes**:
| Element | data-testid |
|---------|-------------|
| Board page container | `board-page` |

**Stories**: US-017 (View Kanban Board), US-022 (Empty State), US-024 (Loading Skeleton)
**Testing Notes**: Test loading state shows skeleton. Test empty state renders when no tasks. Test board renders when tasks exist. Test project switch triggers re-fetch.

- [ ] **13.2** Verify `(dashboard)/layout.tsx` wraps children in `AppShell` (from UOW-01)

**Action**: No changes expected. Confirm the dashboard layout already renders `AppShell` with sidebar and header around `{children}`.

---

## Step 14: Unit Tests

- [ ] **14.1** Create `src/__tests__/validators/task.test.ts`

**Test Coverage**:
- `createTaskSchema`: valid input, missing title, title > 200, description > 5000, invalid category, invalid priority, missing projectId, whitespace-only title (trimmed to empty), SQL injection strings, XSS payloads
- `updateTaskSchema`: valid partial update, empty object, invalid enum values
- `moveTaskSchema`: valid status, invalid status string
- `taskQuerySchema`: valid query, missing projectId

- [ ] **14.2** Create `src/__tests__/stores/task-store.test.ts`

**Test Coverage**:
- `fetchTasks`: sets isLoading, populates tasks, handles API error
- `createTask`: adds task to array, handles API error
- `deleteTask`: removes from array, handles rollback on error
- `moveTask`: synchronous optimistic update
- `updateTaskStatus`: updates correct task
- `updatePipelineState`: updates nested pipelineState
- `setFilter` / `clearFilters`: filter state changes
- `getTasksByStatus`: correct grouping, filter application, sort order
- `reset`: clears all state

- [ ] **14.3** Create `src/__tests__/api/tasks.test.ts`

**Test Coverage**:
- GET /api/tasks: returns tasks for valid project, rejects unauthorized, validates query params
- POST /api/tasks: creates task, validates input, rejects at 100 task limit, rejects unauthorized project
- PATCH /api/tasks/[id]: partial update works, validates input, rejects non-owner
- DELETE /api/tasks/[id]: deletes task, cascade deletes pipeline runs, rejects non-owner
- PATCH /api/tasks/[id]/move: updates status, validates status enum

- [ ] **14.4** Create `src/__tests__/components/task-card.test.tsx`

**Test Coverage**:
- Renders title, category badge, phase indicator, pulse dot, subtask count, timestamp
- Truncates long titles (line-clamp)
- Click navigates to task detail
- Context menu opens on trigger click
- Delete confirmation flow
- Drag attributes applied
- Ghost effect when isDragging
- Overlay style when isDragOverlay

- [ ] **14.5** Create `src/__tests__/components/task-creation-modal.test.tsx`

**Test Coverage**:
- Renders form fields with defaults
- Validation errors display inline on submit with empty fields
- Successful create closes modal and adds task
- Create & Start without API key shows error
- Create & Start with API key works
- Form resets on close
- Character counter updates on description input

- [ ] **14.6** Create `src/__tests__/components/kanban-board.test.tsx`

**Test Coverage**:
- Renders 5 columns with correct headers
- Distributes tasks to correct columns by status
- Empty columns show placeholder text
- DnD context is configured
- (Integration) Drag and drop moves task between columns

- [ ] **14.7** Create `src/__tests__/components/task-detail-view.test.tsx`

**Test Coverage**:
- Renders task data from store
- Fetches task if not in store
- Back button navigates
- Subtask list renders when present
- Subtask list hidden when null
- Placeholder slots render correct text
- 404 redirects to board

**Stories**: Infrastructure (quality assurance for all US-012 -- US-024)
**Testing Notes**: Use Vitest + React Testing Library. Mock Zustand stores. Mock `next/navigation` router. Mock fetch for API tests. Use `@testing-library/user-event` for interaction tests.

---

## Step 15: Documentation Summary

- [ ] **15.1** Update `aidlc-docs/construction/tasks-kanban/` with implementation notes

**Action**: After all steps are complete, create a brief `implementation-notes.md` documenting:
- Actual file paths created (verify against plan)
- Any deviations from the plan and rationale
- shadcn/ui components added (list commands run)
- dnd-kit version pinned
- Migration name and status
- Known limitations or deferred items
- Test coverage summary (pass/fail counts)

**Stories**: N/A (documentation)
**Testing Notes**: N/A

---

## Execution Order & Dependencies

```
Step 1  (Prisma Schema)
  |
Step 2  (Type Definitions)
  |
Step 3  (Zod Validators)
  |
  +---> Step 4  (Task Store) ----+
  |                              |
  +---> Step 5  (API Routes) ----+
                                 |
                            Step 6  (KanbanBoard + KanbanColumn)
                                 |
                            Step 7  (TaskCard + sub-components)
                                 |
                       +---------+---------+
                       |         |         |
                  Step 8     Step 9    Step 10
                  (Modal)   (Detail)  (Filters)
                       |         |         |
                       +---------+---------+
                                 |
                            Step 11 (Empty States)
                                 |
                            Step 12 (Skeleton)
                                 |
                            Step 13 (Dashboard Page)
                                 |
                            Step 14 (Tests)
                                 |
                            Step 15 (Docs)
```

Steps 4 and 5 can be developed in parallel (store and API routes are independent until integration).
Steps 8, 9, and 10 can be developed in parallel (modal, detail, and filters are independent).

---

## Complete File Manifest

| # | File Path | Step | New/Modified |
|---|-----------|------|-------------|
| 1 | `prisma/schema.prisma` | 1 | Modified |
| 2 | `prisma/migrations/XXXXXX_add_task_model/migration.sql` | 1 | New (auto-generated) |
| 3 | `src/types/task.ts` | 2 | New (replaces UOW-01 stub) |
| 4 | `src/lib/validators/task.ts` | 3 | New |
| 5 | `src/stores/task-store.ts` | 4 | New |
| 6 | `src/app/api/tasks/route.ts` | 5 | New |
| 7 | `src/app/api/tasks/[id]/route.ts` | 5 | New |
| 8 | `src/app/api/tasks/[id]/move/route.ts` | 5 | New |
| 9 | `src/components/board/kanban-board.tsx` | 6 | New |
| 10 | `src/components/board/kanban-column.tsx` | 6 | New |
| 11 | `src/components/board/task-card.tsx` | 7 | New |
| 12 | `src/components/board/phase-indicator.tsx` | 7 | New |
| 13 | `src/components/board/pulse-dot.tsx` | 7 | New |
| 14 | `src/components/board/category-badge.tsx` | 7 | New |
| 15 | `src/components/board/task-creation-modal.tsx` | 8 | New |
| 16 | `src/app/(dashboard)/task/[id]/page.tsx` | 9 | New |
| 17 | `src/components/board/task-detail-view.tsx` | 9 | New |
| 18 | `src/hooks/use-task-filters.ts` | 10 | New |
| 19 | `src/components/board/task-filter-bar.tsx` | 10 | New |
| 20 | `src/components/board/empty-board-state.tsx` | 11 | New |
| 21 | `src/components/board/empty-column-state.tsx` | 11 | New |
| 22 | `src/components/board/kanban-board-skeleton.tsx` | 12 | New |
| 23 | `src/app/(dashboard)/board/page.tsx` | 13 | New |
| 24 | `src/__tests__/validators/task.test.ts` | 14 | New |
| 25 | `src/__tests__/stores/task-store.test.ts` | 14 | New |
| 26 | `src/__tests__/api/tasks.test.ts` | 14 | New |
| 27 | `src/__tests__/components/task-card.test.tsx` | 14 | New |
| 28 | `src/__tests__/components/task-creation-modal.test.tsx` | 14 | New |
| 29 | `src/__tests__/components/kanban-board.test.tsx` | 14 | New |
| 30 | `src/__tests__/components/task-detail-view.test.tsx` | 14 | New |
| 31 | `aidlc-docs/construction/tasks-kanban/implementation-notes.md` | 15 | New |

**Total**: 31 files (1 modified, 30 new)

---

## Story Traceability Matrix

| Story | Title | Priority | Steps |
|-------|-------|----------|-------|
| US-012 | Open Task Creation Modal | Must | 8.1, 10.2, 11.1, 13.1 |
| US-013 | Fill Task Creation Form | Must | 2.1, 3.1, 8.1 |
| US-014 | Form Validation | Must | 3.1, 8.1 |
| US-015 | Create Task and Start Pipeline | Must | 8.1 |
| US-016 | Create Task Without Starting Pipeline | Must | 5.1, 8.1 |
| US-017 | View Kanban Board | Must | 4.1, 5.1, 6.1, 6.2, 13.1 |
| US-018 | Drag Task Between Columns | Must | 4.1, 5.3, 6.1, 6.2, 7.1 |
| US-019 | Auto-Move on Pipeline Progress | Must | 4.1, 6.1, 6.2 |
| US-020 | Task Card Details Display | Must | 7.1, 7.2, 7.3, 7.4 |
| US-021 | Click Card to Open Task Detail | Must | 7.1, 9.1, 9.2 |
| US-022 | Empty State | Should | 6.2, 11.1, 11.2, 13.1 |
| US-023 | Filter and Search Tasks | Should | 4.1, 10.1, 10.2 |
| US-024 | Loading Skeleton | Should | 12.1, 13.1 |

---

## Business Rules Coverage Matrix

| Rule ID | Rule Name | Enforced In Steps |
|---------|-----------|-------------------|
| BR-03-001 | Task Title Required (1-200 chars) | 1.1, 3.1, 5.1, 8.1 |
| BR-03-002 | Task Description Optional (max 5000) | 1.1, 3.1, 5.1, 8.1 |
| BR-03-003 | Category Required (enum) | 2.1, 3.1, 5.1, 8.1 |
| BR-03-004 | Priority Required (enum) | 2.1, 3.1, 5.1, 8.1 |
| BR-03-005 | Tasks Scoped to Project | 4.1, 5.1, 5.2, 5.3, 6.1, 13.1 |
| BR-03-006 | Valid Status Transitions | 5.3, 6.1 |
| BR-03-007 | Active Pipeline Drag Restriction | 6.1 |
| BR-03-008 | Create & Start Requires API Key | 8.1 |
| BR-03-009 | Max 100 Tasks Per Project | 5.1 |
| BR-03-010 | Phase Indicator Colors | 2.1, 7.2 |
| BR-03-011 | Pulse Dot Visibility | 7.3 |
| BR-03-012 | Timestamp Display Format | 7.1 |

---

## NFR Coverage Matrix

| NFR ID | Requirement | Addressed In Steps |
|--------|-------------|-------------------|
| NFR-03-001 | Board render < 500ms for 100 tasks | 6.1, 6.2 (virtualization if needed) |
| NFR-03-002 | DnD response < 100ms (optimistic) | 4.1, 6.1 |
| NFR-03-003 | Card animation >= 60fps | 6.2, 7.1 (Framer Motion spring config) |
| NFR-03-004 | SSE board re-render < 200ms | 4.1, 6.1 (store subscription) |
| NFR-03-005 | Task ownership enforcement | 5.1, 5.2, 5.3 |
| NFR-03-006 | Zod shared client/server validation | 3.1, 5.1, 8.1 |
| NFR-03-007 | API key client-only | 8.1 |
| NFR-03-008 | Keyboard DnD | 6.1 (KeyboardSensor) |
| NFR-03-009 | Touch DnD (250ms delay) | 6.1 (TouchSensor) |
| NFR-03-010 | Loading skeleton | 12.1, 13.1 |
| NFR-03-011 | Optimistic rollback | 4.1, 6.1, 7.1 |
| NFR-03-012 | Max 100 tasks enforcement | 5.1 |

---

## Complete data-testid Reference

All interactive elements across UOW-03 components:

| data-testid | Component | Element |
|-------------|-----------|---------|
| `kanban-board` | KanbanBoard | Board container |
| `drag-overlay` | KanbanBoard | Drag overlay wrapper |
| `kanban-column-{status}` | KanbanColumn | Column container (5 instances) |
| `column-header-{status}` | KanbanColumn | Column header |
| `task-count-{status}` | KanbanColumn | Task count badge |
| `task-list-{status}` | KanbanColumn | Scrollable task list area |
| `task-card-{id}` | TaskCard | Card container |
| `task-card-title-{id}` | TaskCard | Card title text |
| `task-subtask-count-{id}` | TaskCard | Subtask progress (e.g., "3/5") |
| `task-timestamp-{id}` | TaskCard | Relative timestamp |
| `task-menu-{id}` | TaskCard | Three-dot context menu trigger |
| `task-delete-{id}` | TaskCard | Delete menu item |
| `task-delete-confirm-{id}` | TaskCard | Delete confirmation button |
| `task-delete-cancel-{id}` | TaskCard | Delete cancel button |
| `phase-indicator` | PhaseIndicator | Phase color dot |
| `pulse-dot` | PulseDot | Animated pulse dot |
| `category-badge-{category}` | CategoryBadge | Category chip |
| `task-creation-modal` | TaskCreationModal | Modal dialog |
| `task-title-input` | TaskCreationModal | Title input field |
| `task-description-input` | TaskCreationModal | Description textarea |
| `task-description-count` | TaskCreationModal | Character counter |
| `task-category-select` | TaskCreationModal | Category dropdown trigger |
| `task-priority-select` | TaskCreationModal | Priority dropdown trigger |
| `task-create-btn` | TaskCreationModal | "Create" button |
| `task-create-start-btn` | TaskCreationModal | "Create & Start" button |
| `task-title-error` | TaskCreationModal | Title validation error |
| `task-description-error` | TaskCreationModal | Description validation error |
| `task-category-error` | TaskCreationModal | Category validation error |
| `task-priority-error` | TaskCreationModal | Priority validation error |
| `task-form-error` | TaskCreationModal | Form-level error |
| `task-detail-view` | TaskDetailView | Detail page container |
| `task-detail-back-btn` | TaskDetailView | Back to board button |
| `task-detail-title` | TaskDetailView | Task title heading |
| `task-detail-priority` | TaskDetailView | Priority badge |
| `task-detail-status` | TaskDetailView | Status label |
| `task-detail-pipeline-slot` | TaskDetailView | Pipeline placeholder |
| `task-detail-description` | TaskDetailView | Description section |
| `task-detail-subtasks` | TaskDetailView | Subtask list container |
| `task-detail-subtask-{id}` | TaskDetailView | Individual subtask item |
| `task-detail-diff-slot` | TaskDetailView | Diff review placeholder |
| `task-detail-created` | TaskDetailView | Created timestamp |
| `task-detail-updated` | TaskDetailView | Updated timestamp |
| `task-filter-bar` | TaskFilterBar | Filter bar container |
| `task-search-input` | TaskFilterBar | Search input field |
| `task-filter-category` | TaskFilterBar | Category filter dropdown |
| `task-filter-priority` | TaskFilterBar | Priority filter dropdown |
| `task-filter-clear` | TaskFilterBar | Clear filters button |
| `task-new-btn` | TaskFilterBar | "+ New Task" button |
| `empty-board-state` | EmptyBoardState | Empty board container |
| `empty-board-create-btn` | EmptyBoardState | "Create first task" CTA |
| `empty-column-state` | EmptyColumnState | Empty column placeholder |
| `kanban-board-skeleton` | KanbanBoardSkeleton | Skeleton container |
| `skeleton-column-{index}` | KanbanBoardSkeleton | Skeleton column (0-4) |
| `board-page` | BoardPage | Page container |
