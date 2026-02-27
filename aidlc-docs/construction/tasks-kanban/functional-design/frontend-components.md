# Frontend Components -- UOW-03: Tasks & Kanban Board

## Overview

This document defines all frontend components delivered in UOW-03. Each component includes its file path, props interface, internal state, user interactions, dnd-kit integration details, Framer Motion animations, and API calls. Components use shadcn/ui primitives, Tailwind v4, Framer Motion, dnd-kit, Lucide icons, and Zustand stores.

---

## Board Components

### KanbanBoard

| Field | Value |
|-------|-------|
| **File** | `src/components/board/kanban-board.tsx` |
| **Type** | Client Component (`"use client"`) |
| **Purpose** | Root Kanban board with DndContext, renders 5 columns, handles drag-and-drop orchestration |
| **Used In** | `src/app/(dashboard)/board/page.tsx` |

**Props Interface**:
```ts
// No external props. Reads from stores.
```

**Internal State**:
- Reads from `taskStore`: `tasks`, `isLoading`, `getTasksByStatus`, `filter`
- Reads from `projectStore`: `activeProjectId`
- Local state:
  ```ts
  {
    activeId: string | null;         // ID of currently dragged task
    overId: string | null;           // ID of current drop target column
  }
  ```

**dnd-kit Integration**:
```ts
<DndContext
  sensors={sensors}
  collisionDetection={closestCorners}
  onDragStart={handleDragStart}
  onDragOver={handleDragOver}
  onDragEnd={handleDragEnd}
  onDragCancel={handleDragCancel}
>
  <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
    {KANBAN_COLUMNS.map(col => (
      <KanbanColumn key={col.status} status={col.status} />
    ))}
  </SortableContext>
  <DragOverlay dropAnimation={customDropAnimation}>
    {activeId ? <TaskCard task={activeTask} isDragOverlay /> : null}
  </DragOverlay>
</DndContext>
```

**Sensors Configuration**:
```ts
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
);
```

**Event Handlers**:

| Handler | Logic |
|---------|-------|
| `handleDragStart` | Set `activeId`, add "is-dragging" body class for cursor override |
| `handleDragOver` | Set `overId` for column highlight |
| `handleDragEnd` | Read target column from droppable ID. Check BR-03-007 (active pipeline guard). Call `taskStore.moveTask(id, newStatus)` optimistically. Fire `PATCH /api/tasks/[id]`. On failure: rollback + error toast. |
| `handleDragCancel` | Reset `activeId` and `overId` |

**Framer Motion**:
- No direct animation on KanbanBoard itself
- DragOverlay uses custom drop animation: `{ duration: 200, easing: "ease-out" }`

**Layout**:
```
┌─────────────────────────────────────────────────────────────────┐
│ [+ New Task]  [Search...]  [Category ▾]  [Priority ▾]          │
├─────────┬──────────┬──────────┬──────────┬──────────┤
│ Backlog │   Spec   │ Building │  Review  │   Done   │
│  (3)    │   (1)    │   (2)    │   (0)    │   (4)    │
│         │          │          │          │          │
│ [Card]  │ [Card]   │ [Card]   │ (empty)  │ [Card]   │
│ [Card]  │          │ [Card]   │          │ [Card]   │
│ [Card]  │          │          │          │ [Card]   │
│         │          │          │          │ [Card]   │
└─────────┴──────────┴──────────┴──────────┴──────────┘
```

**API Calls**:
```ts
// On mount + when activeProjectId changes:
taskStore.fetchTasks(activeProjectId);
// GET /api/tasks?projectId={id}

// On drag end:
PATCH /api/tasks/[id] { status: newStatus }
```

**Business Rules**: BR-03-005, BR-03-006, BR-03-007

---

### KanbanColumn

| Field | Value |
|-------|-------|
| **File** | `src/components/board/kanban-column.tsx` |
| **Type** | Client Component (`"use client"`) |
| **Purpose** | Single Kanban column: header, droppable area, task card list, empty state |

**Props Interface**:
```ts
interface KanbanColumnProps {
  status: TaskStatus;
}
```

**Internal State**:
- Reads from `taskStore`: `getTasksByStatus(status)` (derived/filtered list)
- dnd-kit: `useDroppable({ id: status })`

**dnd-kit Integration**:
```ts
const { isOver, setNodeRef } = useDroppable({ id: props.status });
```
- `setNodeRef` attached to column container div
- `isOver` used to apply highlight class when card is dragged over

**User Interactions**:

| Action | Handler | Result |
|--------|---------|--------|
| Drag card over column | dnd-kit `isOver` | Column background highlights (ring-2 ring-primary/20) |
| Drop card into column | Handled by parent KanbanBoard `onDragEnd` | Card appears in this column |

**Framer Motion (AnimatePresence)**:
```tsx
<AnimatePresence mode="popLayout">
  {tasks.map(task => (
    <motion.div
      key={task.id}
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <TaskCard task={task} />
    </motion.div>
  ))}
</AnimatePresence>
```
- `layout` prop enables smooth reordering animation
- `initial/animate` for enter animation (fade + slide up)
- `exit` for leave animation (fade + slide left)
- Spring physics for natural motion

**Layout**:
```
┌──────────────────┐
│ Backlog    (3)   │  <- header: column name + count badge
├──────────────────┤
│                  │
│  ┌────────────┐  │
│  │  TaskCard  │  │
│  └────────────┘  │
│  ┌────────────┐  │
│  │  TaskCard  │  │
│  └────────────┘  │
│                  │
│  -- or --        │
│                  │
│  ┌ ─ ─ ─ ─ ─ ┐  │
│  │ empty text │  │  <- EmptyColumnState (dashed border)
│  └ ─ ─ ─ ─ ─ ┘  │
│                  │
└──────────────────┘
```

**Styling**:
- Width: flex-1 (equal distribution across 5 columns)
- Min-width: 240px
- Background: muted/5 (subtle gray)
- Border-radius: lg
- Header: sticky top, font-semibold, count badge (muted background)
- Scroll: overflow-y-auto on task list area
- Drop highlight: `isOver && "ring-2 ring-primary/20 bg-primary/5"`

---

### EmptyBoardState

| Field | Value |
|-------|-------|
| **File** | `src/components/board/empty-board-state.tsx` |
| **Type** | Client Component (`"use client"`) |
| **Purpose** | Full-board empty state when project has zero tasks |

**Props Interface**:
```ts
// No external props.
```

**Internal State**:
- Reads from `uiStore`: `openTaskModal`

**User Interactions**:

| Action | Handler | Result |
|--------|---------|--------|
| Click "Create your first task" | `uiStore.openTaskModal()` | Opens TaskCreationModal |

**Layout**:
```
┌─────────────────────────────────────┐
│                                     │
│        [ClipboardList icon]         │  <- Lucide icon, 64px, muted
│                                     │
│         No tasks yet                │  <- text-xl font-semibold
│                                     │
│  Create your first task to get      │  <- text-muted-foreground
│  started with AI-powered            │
│  development.                       │
│                                     │
│     [+ Create your first task]      │  <- Button variant="default"
│                                     │
└─────────────────────────────────────┘
```

**Framer Motion**:
- Fade in on mount: `initial={{ opacity: 0 }}` `animate={{ opacity: 1 }}` `transition={{ duration: 0.3 }}`

**Business Rules**: US-022

---

### EmptyColumnState

| Field | Value |
|-------|-------|
| **File** | `src/components/board/empty-column-state.tsx` |
| **Type** | Client Component |
| **Purpose** | Per-column empty placeholder that doubles as a droppable target |

**Props Interface**:
```ts
interface EmptyColumnStateProps {
  text: string;  // Column-specific placeholder text
}
```

**Layout**:
- Dashed border container, min-height 120px
- Centered muted text
- Acts as droppable target (parent KanbanColumn's `setNodeRef` covers this area)

---

## Task Components

### TaskCard

| Field | Value |
|-------|-------|
| **File** | `src/components/task/task-card.tsx` |
| **Type** | Client Component (`"use client"`) |
| **Purpose** | Draggable task card displaying title, phase indicator, pulse dot, category badge, subtask count, and timestamp |

**Props Interface**:
```ts
interface TaskCardProps {
  task: Task;
  isDragOverlay?: boolean;  // True when rendered inside DragOverlay
}
```

**Internal State**:
- dnd-kit: `useDraggable({ id: task.id })`
- Local: context menu open state

**dnd-kit Integration**:
```ts
const { attributes, listeners, setNodeRef, transform, isDragging } =
  useDraggable({ id: task.id });

const style = {
  transform: CSS.Transform.toString(transform),
  opacity: isDragging ? 0.5 : 1,  // Ghost effect on original position
};
```
- `setNodeRef` on card container
- `listeners` spread on card (entire card is drag handle)
- `attributes` spread for accessibility
- When `isDragOverlay`: elevated shadow, scale 1.02

**User Interactions**:

| Action | Handler | Result |
|--------|---------|--------|
| Click card | `router.push(/task/${task.id})` | Navigate to task detail view |
| Drag card | dnd-kit listeners | Start drag operation |
| Right-click / three-dot button | Open context menu | Show "Delete" option |
| Click "Delete" in context menu | Show confirmation dialog | Trigger delete flow |

**Layout**:
```
┌──────────────────────────────┐
│ ● [PhaseIndicator] [PulseDot]│  <- top-right corner
│                              │
│ Fix login redirect bug       │  <- title (line-clamp-2)
│                              │
│ [Bug Fix]  [3/5] [2h ago]   │  <- bottom row: badge + subtasks + time
└──────────────────────────────┘
```

**Framer Motion**:
- Hover: `whileHover={{ y: -2 }}` (subtle lift)
- Tap: `whileTap={{ scale: 0.98 }}` (press feedback)
- Layout animation for position changes

**Styling**:
- Background: card (white/dark surface)
- Border: border, rounded-lg
- Shadow: shadow-sm, hover:shadow-md
- Padding: p-3
- Cursor: grab (default), grabbing (while dragging)
- Width: 100% of column

**API Calls**:
```ts
// On delete confirmation:
DELETE /api/tasks/[task.id]
```

**Business Rules**: BR-03-007 (active pipeline guard checked in parent), BR-03-010, BR-03-011, BR-03-012

---

### PhaseIndicator

| Field | Value |
|-------|-------|
| **File** | `src/components/task/phase-indicator.tsx` |
| **Type** | Client Component |
| **Purpose** | Colored ring/dot indicating current pipeline phase |

**Props Interface**:
```ts
interface PhaseIndicatorProps {
  phase: PipelinePhase | null;  // null = idle
  size?: "sm" | "md";          // sm for card, md for detail view
}
```

**Internal State**: None (purely derived from props)

**Rendering Logic**:
```ts
const color = PHASE_COLORS[phase ?? "idle"];
// Render: circular div with border-color = color
// Size: sm = 12px, md = 20px
```

**Framer Motion**:
```tsx
<motion.div
  animate={{
    borderColor: color,
    scale: [1, 1.1, 1],  // subtle pulse on phase change
  }}
  transition={{ duration: 0.5 }}
  className="rounded-full border-2"
  style={{ width: size, height: size, borderColor: color }}
/>
```

**Business Rules**: BR-03-010

---

### PulseDot

| Field | Value |
|-------|-------|
| **File** | `src/components/task/pulse-dot.tsx` |
| **Type** | Client Component |
| **Purpose** | Animated pulsing dot visible when pipeline is actively running |

**Props Interface**:
```ts
interface PulseDotProps {
  isActive: boolean;
  color: string;   // Hex color matching PhaseIndicator
}
```

**Rendering Logic**:
```tsx
if (!isActive) return null;

return (
  <span className="relative flex h-2.5 w-2.5">
    <span
      className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
      style={{ backgroundColor: color }}
    />
    <span
      className="relative inline-flex h-2.5 w-2.5 rounded-full"
      style={{ backgroundColor: color }}
    />
  </span>
);
```

**CSS Animation** (Tailwind `animate-ping`):
```css
@keyframes ping {
  75%, 100% {
    transform: scale(2);
    opacity: 0;
  }
}
```

**Business Rules**: BR-03-011

---

### CategoryBadge

| Field | Value |
|-------|-------|
| **File** | `src/components/task/category-badge.tsx` |
| **Type** | Client Component |
| **Purpose** | Colored chip displaying task category |

**Props Interface**:
```ts
interface CategoryBadgeProps {
  category: TaskCategory;
  size?: "sm" | "md";  // sm for card, md for detail view
}
```

**Rendering Logic**:
```tsx
const { bg, text } = CATEGORY_BADGE_COLORS[category];
const label = CATEGORY_LABELS[category];

return (
  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", bg, text)}>
    {label}
  </span>
);
```

---

### TaskCreationModal

| Field | Value |
|-------|-------|
| **File** | `src/components/task/task-creation-modal.tsx` |
| **Type** | Client Component (`"use client"`) |
| **Purpose** | Dialog for creating a new task with dual action buttons |

**Props Interface**:
```ts
// No external props. Reads from stores.
```

**Internal State**:
```ts
{
  title: string;              // Input value
  description: string;        // Textarea value
  category: TaskCategory;     // Select value, default: "feature"
  priority: TaskPriority;     // Select value, default: "medium"
  errors: {                   // Field-level validation errors
    title?: string;
    description?: string;
    category?: string;
    priority?: string;
    form?: string;            // Server-side or API key error
  };
  isCreating: boolean;        // Loading state for "Create"
  isStarting: boolean;        // Loading state for "Create & Start"
}
```

**Reads from stores**:
- `uiStore`: `isTaskModalOpen`, `closeTaskModal`
- `projectStore`: `activeProjectId`
- `taskStore`: `createTask`

**User Interactions**:

| Action | Handler | Result |
|--------|---------|--------|
| Type in title | `onChange` -> update `title` | Clear title error |
| Type in description | `onChange` -> update `description` | Clear description error, textarea auto-expands |
| Select category | `onValueChange` -> update `category` | Clear category error |
| Select priority | `onValueChange` -> update `priority` | Clear priority error |
| Click "Create" | `handleCreate` | Validate -> POST /api/tasks -> close modal |
| Click "Create & Start" | `handleCreateAndStart` | Validate -> check API key -> POST /api/tasks -> POST start-pipeline -> close modal |
| Press Escape / click overlay | `uiStore.closeTaskModal()` | Close without saving |

**Validation (Zod)**:
```ts
// Uses createTaskSchema from lib/validations/task-schemas.ts
// Validation runs on submit, not on every keystroke
// Field-level errors displayed inline below each field
```

**API Calls**:
```ts
// Create:
POST /api/tasks
Body: { title, description, category, priority, projectId }

// Create & Start (additional):
POST /api/tasks/[id]/start-pipeline
Headers: { "x-anthropic-key": decryptedKey }
```

**Layout** (shadcn/ui Dialog):
```
┌────────────────────────────────────────┐
│ Create New Task                    [X] │
├────────────────────────────────────────┤
│                                        │
│ Title *                                │
│ ┌────────────────────────────────────┐ │
│ │ Enter task title...                │ │
│ └────────────────────────────────────┘ │
│ [error message]                        │
│                                        │
│ Description                            │
│ ┌────────────────────────────────────┐ │
│ │ Describe what you want the AI      │ │
│ │ to build... (auto-expand)          │ │
│ └────────────────────────────────────┘ │
│                            0/5000      │
│                                        │
│ Category *              Priority *     │
│ ┌─────────────────┐   ┌──────────────┐│
│ │ Feature       ▾ │   │ Medium     ▾ ││
│ └─────────────────┘   └──────────────┘│
│                                        │
│ [form-level error message]             │
│                                        │
├────────────────────────────────────────┤
│         [Create]   [Create & Start ▶]  │
└────────────────────────────────────────┘
```

**Framer Motion**:
- Dialog entry: `initial={{ opacity: 0, scale: 0.95 }}` `animate={{ opacity: 1, scale: 1 }}`
- Dialog exit: `exit={{ opacity: 0, scale: 0.95 }}`

**Business Rules**: BR-03-001, BR-03-002, BR-03-003, BR-03-004, BR-03-008, BR-03-009

---

### TaskDetailView

| Field | Value |
|-------|-------|
| **Route** | `/task/[id]` (route group: `(dashboard)`) |
| **File** | `src/app/(dashboard)/task/[id]/page.tsx` (page) + `src/components/task/task-detail-view.tsx` (component) |
| **Type** | Page (Server Component shell) + Client Component (detail view) |
| **Purpose** | Full task detail view with pipeline visualization slot and diff review slot |

**Props Interface (component)**:
```ts
interface TaskDetailViewProps {
  taskId: string;
}
```

**Internal State**:
```ts
{
  task: Task | null;
  isLoading: boolean;
  error: string | null;
}
```

**Reads from stores**:
- `taskStore`: `tasks` (to find task by ID, avoiding redundant fetch if already loaded)

**User Interactions**:

| Action | Handler | Result |
|--------|---------|--------|
| Click "Back to Board" | `router.back()` or `router.push("/board")` | Return to Kanban board |
| View pipeline visualization | Render placeholder slot | "Pipeline visualization appears when pipeline runs" |
| View diff review | Render placeholder slot | "Code diff appears after pipeline completion" |

**API Calls**:
```ts
// On mount (if task not in taskStore):
GET /api/tasks/[id]
```

**Layout**:
```
┌──────────────────────────────────────────────────┐
│ [← Back to Board]                                │
│                                                  │
│ ┌──────────────────────────────────────────────┐ │
│ │ Fix login redirect bug              [High]   │ │
│ │ [Bug Fix]  Status: Building                  │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ ┌──────────────────────────────────────────────┐ │
│ │ Pipeline Visualization                       │ │
│ │                                              │ │
│ │ (UOW-05 slot -- placeholder in UOW-03)       │ │
│ │ "Pipeline visualization will appear here     │ │
│ │  when a pipeline runs."                      │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ Description                                      │
│ ┌──────────────────────────────────────────────┐ │
│ │ The login page should redirect authenticated │ │
│ │ users to /board instead of showing the form. │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ Subtasks (2/5)                                   │
│ ┌──────────────────────────────────────────────┐ │
│ │ ✓ Create database migration                  │ │
│ │ ✓ Implement user registration endpoint       │ │
│ │ ○ Add registration form component            │ │
│ │ ○ Write unit tests                           │ │
│ │ ○ Add E2E test                               │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ ┌──────────────────────────────────────────────┐ │
│ │ Diff Review Panel                            │ │
│ │                                              │ │
│ │ (UOW-06 slot -- placeholder in UOW-03)       │ │
│ │ "Code diff will appear here after pipeline   │ │
│ │  completion."                                │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ Created: Feb 26, 2026   Updated: 2h ago          │
└──────────────────────────────────────────────────┘
```

**Framer Motion**:
- Page enter: `initial={{ opacity: 0, y: 10 }}` `animate={{ opacity: 1, y: 0 }}` `transition={{ duration: 0.2 }}`

**Business Rules**: US-021

---

## Board Page

### BoardPage

| Field | Value |
|-------|-------|
| **Route** | `/board` (route group: `(dashboard)`) |
| **File** | `src/app/(dashboard)/board/page.tsx` |
| **Type** | Client Component (`"use client"`) |
| **Purpose** | Main dashboard page rendering KanbanBoard or EmptyBoardState |

**Rendering Logic**:
```tsx
export default function BoardPage() {
  const { tasks, isLoading } = useTaskStore();
  const { activeProjectId } = useProjectStore();

  useEffect(() => {
    if (activeProjectId) {
      taskStore.fetchTasks(activeProjectId);
    }
  }, [activeProjectId]);

  if (isLoading) return <KanbanBoardSkeleton />;
  if (tasks.length === 0) return <EmptyBoardState />;
  return (
    <>
      <KanbanBoard />
      <TaskCreationModal />
    </>
  );
}
```

---

### KanbanBoardSkeleton

| Field | Value |
|-------|-------|
| **File** | `src/components/board/kanban-board-skeleton.tsx` |
| **Type** | Client Component |
| **Purpose** | Loading skeleton placeholder matching board layout |

**Layout**:
```
┌─────────┬──────────┬──────────┬──────────┬──────────┐
│ ▓▓▓▓▓▓  │ ▓▓▓▓▓▓   │ ▓▓▓▓▓▓   │ ▓▓▓▓▓▓   │ ▓▓▓▓▓▓   │  <- skeleton headers
│         │          │          │          │          │
│ ┌─────┐ │ ┌─────┐  │ ┌─────┐  │ ┌─────┐  │ ┌─────┐  │
│ │░░░░░│ │ │░░░░░│  │ │░░░░░│  │ │░░░░░│  │ │░░░░░│  │  <- skeleton cards
│ └─────┘ │ └─────┘  │ └─────┘  │ └─────┘  │ └─────┘  │
│ ┌─────┐ │          │ ┌─────┐  │          │ ┌─────┐  │
│ │░░░░░│ │          │ │░░░░░│  │          │ │░░░░░│  │
│ └─────┘ │          │ └─────┘  │          │ └─────┘  │
└─────────┴──────────┴──────────┴──────────┴──────────┘
```

**Animation**: Tailwind `animate-pulse` on skeleton elements

**Business Rules**: US-024

---

## Filter Components (US-023)

### TaskFilterBar

| Field | Value |
|-------|-------|
| **File** | `src/components/board/task-filter-bar.tsx` |
| **Type** | Client Component (`"use client"`) |
| **Purpose** | Search input + category/priority filter dropdowns + "New Task" button |

**Props Interface**:
```ts
// No external props. Reads/writes taskStore.filter.
```

**Internal State**:
- Reads from `taskStore`: `filter`
- Reads from `uiStore`: `openTaskModal`

**User Interactions**:

| Action | Handler | Result |
|--------|---------|--------|
| Type in search input | `taskStore.setFilter({ search })` | Filter tasks across all columns by title/description match |
| Select category filter | `taskStore.setFilter({ category })` | Show only tasks matching category |
| Select priority filter | `taskStore.setFilter({ priority })` | Show only tasks matching priority |
| Click "Clear" (when filters active) | `taskStore.clearFilters()` | Reset all filters, show all tasks |
| Click "+ New Task" | `uiStore.openTaskModal()` | Open task creation modal |

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ [🔍 Search tasks...]  [Category ▾]  [Priority ▾]  [+ New Task] │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Dependency Tree (UOW-03 Scope)

```
Dashboard Pages (with AppShell from UOW-01):
  (dashboard)/layout.tsx
    AppShell
      {children}
        board/page.tsx (BoardPage)
          |
          ├── KanbanBoardSkeleton       [isLoading state]
          |
          ├── EmptyBoardState           [uiStore.openTaskModal]
          |
          ├── TaskFilterBar             [taskStore.filter, uiStore]
          |
          ├── KanbanBoard               [taskStore, projectStore, dnd-kit DndContext]
          |     |
          |     ├── KanbanColumn (x5)   [taskStore.getTasksByStatus, dnd-kit useDroppable]
          |     |     |
          |     |     ├── TaskCard (xN) [dnd-kit useDraggable, router]
          |     |     |     |
          |     |     |     ├── PhaseIndicator    [task.pipelineState]
          |     |     |     ├── PulseDot          [task.pipelineState.isActive]
          |     |     |     ├── CategoryBadge     [task.category]
          |     |     |     └── (subtask count + timestamp inline)
          |     |     |
          |     |     └── EmptyColumnState       [column-specific text]
          |     |
          |     └── DragOverlay
          |           └── TaskCard (overlay)
          |
          └── TaskCreationModal         [uiStore, taskStore, projectStore]
        |
        task/[id]/page.tsx (TaskDetailPage)
          |
          └── TaskDetailView            [taskStore, router]
                |
                ├── PhaseIndicator
                ├── CategoryBadge
                ├── Subtask list (inline)
                ├── Pipeline slot (placeholder)
                └── Diff slot (placeholder)
```

---

## Zustand Store Usage by Component

| Component | taskStore | projectStore | uiStore | Notes |
|-----------|-----------|-------------|---------|-------|
| BoardPage | read (tasks, isLoading) | read (activeProjectId) | - | Orchestrates fetch |
| KanbanBoard | read/write (getTasksByStatus, moveTask) | - | - | DnD orchestration |
| KanbanColumn | read (getTasksByStatus) | - | - | Renders filtered tasks |
| TaskCard | - | - | - | Pure display + dnd |
| TaskCreationModal | write (createTask) | read (activeProjectId) | read/write (isTaskModalOpen) | Form submission |
| TaskFilterBar | read/write (filter) | - | write (openTaskModal) | Filter controls |
| TaskDetailView | read (tasks for lookup) | - | - | Task data display |
| EmptyBoardState | - | - | write (openTaskModal) | CTA button |

---

## shadcn/ui Components Required (UOW-03)

| Component | Used By | Purpose |
|-----------|---------|---------|
| Dialog | TaskCreationModal | Modal overlay |
| Button | TaskCreationModal, EmptyBoardState, TaskFilterBar | Actions |
| Input | TaskCreationModal, TaskFilterBar | Title input, search |
| Textarea | TaskCreationModal | Description input |
| Select | TaskCreationModal, TaskFilterBar | Category, Priority |
| Label | TaskCreationModal | Form field labels |
| Badge | KanbanColumn (count), CategoryBadge | Count + category display |
| Tooltip | TaskCard (timestamp hover) | Absolute time display |
| Sonner (toast) | KanbanBoard, TaskCreationModal | Success/error notifications |
| DropdownMenu | TaskCard (context menu) | Delete action |
| AlertDialog | TaskCard (delete confirmation) | Confirmation prompt |
| Skeleton | KanbanBoardSkeleton | Loading placeholders |
| Separator | TaskDetailView | Section dividers |
| ScrollArea | KanbanColumn | Scrollable task list |

---

## Third-Party Library Integration

### dnd-kit

| Package | Usage |
|---------|-------|
| `@dnd-kit/core` | DndContext, DragOverlay, useDraggable, useDroppable, PointerSensor, KeyboardSensor |
| `@dnd-kit/sortable` | SortableContext (for column ordering) |
| `@dnd-kit/utilities` | CSS.Transform |

**Accessibility**:
- KeyboardSensor enabled for keyboard-only DnD
- ARIA labels on draggable cards: `aria-label="Drag task: {title}"`
- ARIA labels on droppable columns: `aria-label="Drop zone: {column name}"`
- Announcements for screen readers on drag start/end

### Framer Motion

| Component | Animation |
|-----------|-----------|
| KanbanColumn (AnimatePresence) | Card enter/exit/layout animations |
| TaskCard | Hover lift, tap scale, layout position |
| PhaseIndicator | Color transition, scale pulse on phase change |
| TaskCreationModal (Dialog) | Scale + opacity entry/exit |
| EmptyBoardState | Fade in on mount |
| TaskDetailView | Slide up on mount |

### Lucide Icons

| Icon | Used In | Purpose |
|------|---------|---------|
| Plus | TaskFilterBar, EmptyBoardState | "New Task" button |
| Search | TaskFilterBar | Search input prefix |
| ClipboardList | EmptyBoardState | Empty state illustration |
| CheckSquare | TaskCard | Subtask count indicator |
| MoreVertical | TaskCard | Context menu trigger |
| Trash2 | TaskCard context menu | Delete action |
| ArrowLeft | TaskDetailView | "Back to Board" button |
| ArrowUp / ArrowDown | Priority display | Priority icons |
| Clock | TaskCard | Timestamp icon |
| X | TaskCreationModal | Close button |
