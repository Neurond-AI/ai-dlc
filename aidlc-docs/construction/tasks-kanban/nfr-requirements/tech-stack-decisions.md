# Tech Stack Decisions -- UOW-03: Tasks & Kanban Board

## Overview

Technology decisions specific to UOW-03. This unit introduces **three new dependencies** from the dnd-kit ecosystem for drag-and-drop functionality. All other technologies are inherited from the UOW-01 baseline.

---

## Baseline Reference

Technologies from UOW-01 used in UOW-03:

| Technology | UOW-03 Usage |
|-----------|-------------|
| Next.js 15 (App Router) | API routes: `GET/POST /api/tasks`, `PATCH/DELETE /api/tasks/[id]`. Pages: `/board`, `/task/[id]` |
| React 19 | KanbanBoard, KanbanColumn, TaskCard, TaskCreationModal, TaskDetailView components |
| Prisma 6 | TaskService queries with project ownership filter, task count enforcement |
| Zod 3 | `task-schemas.ts` -- createTaskSchema, updateTaskSchema, taskStatusSchema |
| Zustand 5 | `taskStore` -- task list, CRUD actions, optimistic updates, rollback |
| shadcn/ui | Dialog (task creation modal), Select (category/priority), Input, Textarea, Skeleton, Tooltip |
| Tailwind CSS 4 | Board layout (grid/flex), column styling, card styling, responsive breakpoints |
| Framer Motion | AnimatePresence for card enter/exit, layout animations for column reorder, drag overlay opacity |
| Lucide React | Icons: `Plus`, `GripVertical`, `Clock`, `Tag`, `Flag`, `MoreHorizontal`, `Trash2` |
| better-auth | Session validation on all task API routes |

---

## New Dependencies

| Technology | Version | Purpose | Rationale |
|-----------|---------|---------|-----------|
| @dnd-kit/core | latest | Drag-and-drop primitives | Accessible DnD engine with keyboard + touch + pointer sensors, collision detection, drag overlay |
| @dnd-kit/sortable | latest | Sortable list behavior | SortableContext for within-column ordering, useSortable hook for individual cards |
| @dnd-kit/utilities | latest | DnD utility functions | CSS transform utilities for performant card positioning during drag |

### Why @dnd-kit

**Primary reasons**:
1. **Accessibility**: Built-in keyboard sensor with arrow key navigation and screen reader announcements. WCAG compliance out of the box.
2. **Touch support**: Configurable TouchSensor with delay/tolerance to prevent accidental drags during scroll.
3. **Lightweight**: ~12KB gzipped (core + sortable + utilities combined). No heavy abstractions.
4. **React 19 compatible**: Uses React's `useSyncExternalStore` pattern. No deprecated lifecycle methods or legacy context API.
5. **Modular**: Sensors, collision detection, and drag overlay are composable -- import only what's needed.

### Alternatives Considered

| Alternative | Why Rejected |
|-------------|-------------|
| react-beautiful-dnd | **Deprecated** by Atlassian (archived Feb 2024). No React 19 support. No maintenance or security patches. Known issues with StrictMode double-render. |
| react-dnd | More complex API (backends, monitors, connectors). Requires separate HTML5 backend + touch backend. No built-in keyboard accessibility. Heavier learning curve for equivalent functionality. |
| @hello-pangea/dnd | Fork of react-beautiful-dnd. Active maintenance but inherits architectural limitations. No keyboard sensor (only mouse + touch). Less composable than dnd-kit. |
| Native HTML Drag API | No touch support on mobile. No keyboard drag support. Inconsistent behavior across browsers. Poor animation control. Not accessible. |
| Pragmatic Drag and Drop | Atlassian's successor to react-beautiful-dnd. Still early/evolving. Less community adoption and fewer examples. dnd-kit has more mature ecosystem and documentation. |

### React 19 Compatibility Notes

- **@dnd-kit/core**: Compatible. Uses `useRef`, `useCallback`, `useEffect` -- no deprecated APIs. DndContext uses standard React context (not legacy).
- **@dnd-kit/sortable**: Compatible. `useSortable` hook relies on `useSyncExternalStore`-compatible patterns.
- **@dnd-kit/utilities**: Compatible. Pure utility functions with CSS transform helpers -- no React dependency.
- **Framer Motion**: Already in stack (UOW-01). AnimatePresence and layout animations work with React 19 concurrent features. Used alongside dnd-kit for card enter/exit animations (dnd-kit handles drag positioning, Framer Motion handles non-drag animations).

---

## Version Pinning

Following UOW-01 version pinning strategy (exact versions, no `^` or `~`):

| Package | Pin Strategy |
|---------|-------------|
| @dnd-kit/core | Pin to latest stable at UOW-03 implementation start |
| @dnd-kit/sortable | Pin to same minor version as @dnd-kit/core (ecosystem version alignment) |
| @dnd-kit/utilities | Pin to same minor version as @dnd-kit/core |

All three packages should be updated together to maintain ecosystem compatibility.

---

## Component Reuse

### shadcn/ui Components (from UOW-01)

| shadcn/ui Component | UOW-03 Usage |
|---------------------|-------------|
| `Dialog` + `DialogContent` + `DialogHeader` + `DialogFooter` | TaskCreationModal |
| `Select` + `SelectTrigger` + `SelectContent` + `SelectItem` | Category and priority dropdowns |
| `Input` | Task title field |
| `Textarea` | Task description field |
| `Button` | Create, Create & Start, Cancel, Delete actions |
| `Skeleton` | Loading skeleton for board columns and task cards |
| `Tooltip` | Timestamp hover (relative -> absolute), truncated title hover |
| `Badge` | Category badge on task card |
| `DropdownMenu` | Task card kebab menu (edit, delete) |

### New shadcn/ui Components to Add

| Component | Purpose |
|-----------|---------|
| `Textarea` | Task description input (if not already added in UOW-01) |
| `Badge` | Category badges on task cards (if not already added in UOW-01) |

Verify during implementation which shadcn/ui components need `npx shadcn@latest add`.
