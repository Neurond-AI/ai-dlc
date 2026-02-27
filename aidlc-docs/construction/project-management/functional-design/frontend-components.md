# Frontend Components -- UOW-02: Project Management

## Overview

This document defines all frontend components delivered in UOW-02 and modifications to existing UOW-01 components. UOW-02 introduces the project switcher in the sidebar, project CRUD modals/dialogs, and wires the projectStore into the layout. Components use shadcn/ui primitives, Tailwind v4 for styling, and Lucide for icons.

---

## New Components

### ProjectSwitcher

| Field | Value |
|-------|-------|
| **File** | `src/components/layout/project-switcher.tsx` |
| **Type** | Client Component (`"use client"`) |
| **Purpose** | Dropdown in sidebar showing all projects, allowing switching, and providing access to project CRUD actions |

**Props Interface**:
```ts
// No external props. Reads from projectStore.
```

**Internal State**:
```ts
{
  isOpen: boolean;                // Dropdown open state
  isCreateModalOpen: boolean;     // CreateProjectModal visibility
  renameProjectId: string | null; // Project being renamed (null = dialog closed)
  deleteProjectId: string | null; // Project being deleted (null = dialog closed)
}
```

**User Interactions**:

| Action | Handler | Result |
|--------|---------|--------|
| Click trigger button | Toggle `isOpen` | Open/close dropdown |
| Click a project item | `projectStore.setActiveProject(id)` | Switch active project, close dropdown |
| Click edit icon on project item | Set `renameProjectId` | Open RenameProjectDialog for that project |
| Click delete icon on project item | Set `deleteProjectId` | Open DeleteProjectDialog for that project |
| Click "New Project" button at bottom | Set `isCreateModalOpen = true` | Open CreateProjectModal |

**UI Structure** (shadcn/ui Popover):
```
[Trigger: Current project name + ChevronDown]
  |
  v (popover dropdown)
  +-----------------------------------+
  | Projects                          |
  |-----------------------------------|
  | [check] Project A        [Pen][X] |
  |         Project B        [Pen][X] |
  |         Project C        [Pen][X] |
  |-----------------------------------|
  | [Plus] New Project                |
  +-----------------------------------+
```

**Layout Details**:
- Trigger shows active project name (truncated to fit sidebar width)
- Checkmark icon on the active project
- Edit (Pencil) and delete (Trash2) icons appear on hover for each project item
- "New Project" button at bottom with Plus icon
- Dropdown auto-closes on project selection
- Dropdown stays open when clicking edit/delete icons (modal opens on top)

**Responsive Behavior**:
- Desktop (>= 1024px, sidebar expanded): shows full project name in trigger
- Tablet (768-1023px, sidebar collapsed): trigger shows only FolderOpen icon; dropdown opens as popover anchored to icon
- Mobile (< 768px): trigger in sidebar overlay, full interaction

**API Calls**: None directly -- delegates to projectStore actions and child modals.

**Business Rules**: BR-02-003, BR-02-007

---

### CreateProjectModal

| Field | Value |
|-------|-------|
| **File** | `src/components/project/create-project-modal.tsx` |
| **Type** | Client Component (`"use client"`) |
| **Purpose** | Modal dialog for creating a new project with name input |

**Props Interface**:
```ts
interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}
```

**Internal State**:
```ts
{
  name: string;          // Input value
  error: string | null;  // Validation or server error
  isSubmitting: boolean;  // Loading state during API call
}
```

**User Interactions**:

| Action | Handler | Result |
|--------|---------|--------|
| Type in name field | `onChange` -> update `name` | Clear error on change |
| Click "Create" / press Enter | `onSubmit` -> validate -> call API | Create project or show error |
| Click "Cancel" / press Escape | `onClose()` | Close modal, reset state |
| Click backdrop | `onClose()` | Close modal, reset state |

**Validation (Zod Schema)**:
```ts
// Reuses createProjectSchema from validations/project-schemas.ts
const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required").max(50, "Project name must be 50 characters or fewer"),
});
```

**API Calls**:
```ts
// On submit (after client validation passes):
const project = await projectStore.createProject(name);
// projectStore internally calls POST /api/projects
// On success: modal closes, toast shown, project becomes active
// On error: display server error in modal
```

**Error Handling**:
- 409 (duplicate name): show "A project with this name already exists" below input
- 400 (max projects): show "Maximum of 20 projects reached" below input
- 500: show "Something went wrong. Please try again."

**UI Elements** (shadcn/ui Dialog):
- Dialog title: "Create project"
- Name `<Input>` with label "Project name" and placeholder "Enter project name"
- Error message below input (red text)
- Footer: `<Button variant="outline">Cancel</Button>` + `<Button>Create</Button>` with loading spinner

**Business Rules**: BR-02-001, BR-02-002, BR-02-008

---

### RenameProjectDialog

| Field | Value |
|-------|-------|
| **File** | `src/components/project/rename-project-dialog.tsx` |
| **Type** | Client Component (`"use client"`) |
| **Purpose** | Dialog for renaming an existing project, pre-filled with current name |

**Props Interface**:
```ts
interface RenameProjectDialogProps {
  projectId: string;
  currentName: string;
  isOpen: boolean;
  onClose: () => void;
}
```

**Internal State**:
```ts
{
  name: string;          // Input value (initialized to currentName)
  error: string | null;  // Validation or server error
  isSubmitting: boolean;  // Loading state during API call
}
```

**User Interactions**:

| Action | Handler | Result |
|--------|---------|--------|
| Type in name field | `onChange` -> update `name` | Clear error on change |
| Click "Rename" / press Enter | `onSubmit` -> validate -> call API | Rename project or show error |
| Click "Cancel" / press Escape | `onClose()` | Close dialog, reset state |

**Validation (Zod Schema)**:
```ts
// Reuses renameProjectSchema from validations/project-schemas.ts
// Additional client-side check: name !== currentName
```

**API Calls**:
```ts
// On submit (after client validation passes):
await projectStore.renameProject(projectId, name);
// projectStore internally calls PATCH /api/projects/[id]
// On success: dialog closes, toast "Project renamed"
// On error: display server error in dialog
```

**Error Handling**:
- Client: if name === currentName, show "Name unchanged" (no API call)
- 409 (duplicate name): show "A project with this name already exists"
- 404: show "Project not found" (edge case -- project deleted by another tab)
- 500: show "Something went wrong. Please try again."

**UI Elements** (shadcn/ui Dialog):
- Dialog title: "Rename project"
- Name `<Input>` with label "Project name", pre-filled with `currentName`, auto-focused and text selected
- Error message below input (red text)
- Footer: `<Button variant="outline">Cancel</Button>` + `<Button>Rename</Button>` with loading spinner

**Business Rules**: BR-02-001, BR-02-002

---

### DeleteProjectDialog

| Field | Value |
|-------|-------|
| **File** | `src/components/project/delete-project-dialog.tsx` |
| **Type** | Client Component (`"use client"`) |
| **Purpose** | Confirmation dialog before deleting a project and all its tasks |

**Props Interface**:
```ts
interface DeleteProjectDialogProps {
  projectId: string;
  projectName: string;
  isLastProject: boolean;
  isOpen: boolean;
  onClose: () => void;
}
```

**Internal State**:
```ts
{
  isDeleting: boolean;  // Loading state during API call
  error: string | null; // Server error
}
```

**User Interactions**:

| Action | Handler | Result |
|--------|---------|--------|
| Click "Delete" | `onConfirm` -> call API | Delete project or show error |
| Click "Cancel" / press Escape | `onClose()` | Close dialog |

**API Calls**:
```ts
// On confirm:
await projectStore.deleteProject(projectId);
// projectStore.deleteProject handles:
//   1. If last project: create default "My Project" first
//   2. DELETE /api/projects/[id]
//   3. Switch to next available project
// On success: dialog closes, toast "Project deleted"
// On error: display server error in dialog
```

**UI Elements** (shadcn/ui AlertDialog):
- Title: "Delete project?"
- Description: "This will permanently delete **{projectName}** and all its tasks. This action cannot be undone."
- If `isLastProject`: additional note "A new default project will be created automatically."
- Footer: `<Button variant="outline">Cancel</Button>` + `<Button variant="destructive">Delete</Button>` with loading spinner

**Business Rules**: BR-02-004, BR-02-005, BR-02-006

---

## Modified Components (from UOW-01)

### Sidebar (Updated)

| Field | Value |
|-------|-------|
| **File** | `src/components/layout/sidebar.tsx` |
| **Changes** | Replace static project name stub with `<ProjectSwitcher />` component |

**UOW-01 State**: Footer showed static text "My Project" as a non-functional stub.

**UOW-02 Changes**:
- Replace static project name with `<ProjectSwitcher />` in sidebar footer area
- ProjectSwitcher reads from projectStore for project list and active project
- Sidebar now depends on `projectStore` in addition to `uiStore`

**Updated Footer Section**:
```
Sidebar Footer (above collapse toggle):
  <ProjectSwitcher />
```

---

### Header (Updated)

| Field | Value |
|-------|-------|
| **File** | `src/components/layout/header.tsx` |
| **Changes** | Replace static project name in center section with active project name from projectStore |

**UOW-01 State**: Center section showed static "Project name (stub)" text.

**UOW-02 Changes**:
- Read `activeProject` from projectStore
- Display `activeProject.name` in center section
- If `projectStore.isLoading`: show skeleton placeholder
- Header now depends on `projectStore` in addition to `authStore` and `uiStore`

**Updated Center Section**:
```
[Center Section]
  - Active project name (read from projectStore.activeProject.name)
  - Skeleton placeholder while projectStore.isLoading
```

---

### DashboardLayout (Updated)

| Field | Value |
|-------|-------|
| **File** | `src/app/(dashboard)/layout.tsx` |
| **Changes** | Initialize projectStore on mount |

**UOW-02 Changes**:
- Add projectStore initialization logic (fetchProjects) on dashboard mount
- Ensure projects are loaded before rendering child routes
- Handle default project creation if no projects exist (US-011)

**Initialization Sequence**:
```
DashboardLayout mounts
  |
  [1] authStore.hydrate() (from UOW-01)
  [2] projectStore.fetchProjects()
      - If empty: create default project "My Project"
      - Resolve activeProjectId from localStorage or first project
  [3] Render AppShell + children once both stores are ready
```

---

## Component Dependency Tree (UOW-02 Additions)

```
Dashboard Pages (with AppShell):
  (dashboard)/layout.tsx     [Server Component -- initializes projectStore]
    AppShell                 [uiStore, authStore]
      Sidebar                [uiStore, usePathname, projectStore] <-- UPDATED
        ProjectSwitcher      [projectStore]                       <-- NEW
          CreateProjectModal [projectStore]                       <-- NEW
          RenameProjectDialog [projectStore]                      <-- NEW
          DeleteProjectDialog [projectStore]                      <-- NEW
      Header                 [authStore, uiStore, projectStore]   <-- UPDATED
        UserMenu             [authStore]
      {children}             [route content]
      BottomDock             [uiStore]
```

---

## Zustand Store Usage by Component

| Component | authStore | uiStore | projectStore | Notes |
|-----------|-----------|---------|-------------|-------|
| ProjectSwitcher | - | - | read/write | Lists projects, switches active |
| CreateProjectModal | - | - | write (create) | Creates project via store |
| RenameProjectDialog | - | - | write (rename) | Renames project via store |
| DeleteProjectDialog | - | - | write (delete) | Deletes project via store |
| Sidebar | - | read/write | read | Shows ProjectSwitcher |
| Header | read | read/write | read | Shows active project name |
| DashboardLayout | read | - | write (init) | Initializes projectStore |

---

## shadcn/ui Components Required (UOW-02 -- Additional)

| Component | Used By | Purpose |
|-----------|---------|---------|
| Popover | ProjectSwitcher | Dropdown for project list |
| Dialog | CreateProjectModal, RenameProjectDialog | Modal dialogs |
| AlertDialog | DeleteProjectDialog | Confirmation dialog |
| Input | CreateProjectModal, RenameProjectDialog | Name input fields |
| Button | All project components | Actions (Create, Rename, Delete, Cancel) |
| Sonner (toast) | All project mutations | Success/error notifications |
| Separator | ProjectSwitcher | Visual divider above "New Project" |

**Note**: Popover is new for UOW-02 (not used in UOW-01). Dialog, AlertDialog, Input, Button, and Sonner are already installed from UOW-01.

---

## Component-to-Story Traceability

| Component | Stories |
|-----------|---------|
| ProjectSwitcher | US-007, US-008, US-009, US-010 |
| CreateProjectModal | US-007 |
| RenameProjectDialog | US-009 |
| DeleteProjectDialog | US-010 |
| Sidebar (updated) | US-008 |
| Header (updated) | US-008 |
| DashboardLayout (updated) | US-011 |
