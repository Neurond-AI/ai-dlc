# Business Logic Model -- UOW-02: Project Management

## Overview

This document defines the business processes for UOW-02, covering project CRUD operations, the project switcher, default project creation on first login, and the projectStore. All operations enforce ownership -- users can only access their own projects. The ProjectService handles server-side logic; the projectStore manages client-side state via Zustand.

---

## 1. Create Project Flow

**Trigger**: User clicks "New Project" in the ProjectSwitcher dropdown

```
Client (CreateProjectModal)
  |
  [1] User clicks "New Project" at bottom of ProjectSwitcher dropdown
  [2] CreateProjectModal opens with name input field
  [3] Client-side validation (Zod):
      - name: required, 1-50 characters, trimmed
  |
  [4] POST /api/projects { name }
  |
Server (ProjectRouteHandler -> ProjectService)
  |
  [5] Authenticate: extract userId from session (via better-auth)
      - If no session: return 401
  [6] Validate input (Zod):
      - name: string, min 1, max 50, trimmed
  [7] Check uniqueness: case-insensitive lookup
      - SELECT WHERE userId = ? AND LOWER(name) = LOWER(?)
      - If duplicate: return 409 "A project with this name already exists"
  [8] Check project count limit:
      - COUNT WHERE userId = ?
      - If >= 20: return 400 "Maximum of 20 projects reached"
  [9] Create Project record in PostgreSQL (via Prisma)
  [10] Return created project JSON (id, name, userId, createdAt, updatedAt)
  |
Client (onSuccess callback)
  |
  [11] projectStore: add project to projects[]
  [12] projectStore: set activeProjectId to new project id
  [13] Persist activeProjectId to localStorage
  [14] Close CreateProjectModal
  [15] Show success toast: "Project created"
  [16] taskStore: clear tasks (new project has none)
```

**Error States**:

| Condition | Error Message | HTTP Status |
|-----------|--------------|-------------|
| Empty name | "Project name is required" | 400 (client-side) |
| Name too long | "Project name must be 50 characters or fewer" | 400 (client-side) |
| Duplicate name | "A project with this name already exists" | 409 |
| Max projects reached | "Maximum of 20 projects reached" | 400 |
| Not authenticated | Redirect to /login | 401 |
| Server error | "Something went wrong. Please try again." | 500 |

---

## 2. Switch Project Flow

**Trigger**: User selects a different project from the ProjectSwitcher dropdown

```
Client (ProjectSwitcher)
  |
  [1] User opens ProjectSwitcher dropdown in sidebar
  [2] Dropdown shows all projects, active project highlighted with checkmark
  [3] User clicks a different project
  |
  [4] projectStore.setActiveProject(projectId)
  [5] Persist activeProjectId to localStorage
  [6] taskStore.fetchTasks(projectId) -- reload tasks for new project
  [7] ProjectSwitcher dropdown closes
  [8] Header/sidebar updates to show new project name
  |
  No API call needed -- projects are already loaded in projectStore.
  Only tasks are refetched for the newly selected project.
```

**Edge Cases**:
- If fetching tasks fails: show error toast "Failed to load tasks", keep previous project active
- If active project was deleted by another tab: fetch projects, fallback to first project

---

## 3. Rename Project Flow

**Trigger**: User clicks edit icon on a project in ProjectSwitcher, or opens RenameProjectDialog

```
Client (RenameProjectDialog)
  |
  [1] User clicks edit icon (Pencil) on a project item in ProjectSwitcher
  [2] RenameProjectDialog opens, pre-filled with current project name
  [3] User edits name
  [4] Client-side validation (Zod):
      - name: required, 1-50 characters, trimmed
      - name: must differ from current name
  |
  [5] PATCH /api/projects/[id] { name }
  |
Server (ProjectRouteHandler -> ProjectService)
  |
  [6] Authenticate: extract userId from session
  [7] Validate input (Zod): name min 1, max 50, trimmed
  [8] Ownership check: find project WHERE id = ? AND userId = ?
      - If not found: return 404 "Project not found"
  [9] Check uniqueness: case-insensitive lookup (exclude current project)
      - SELECT WHERE userId = ? AND LOWER(name) = LOWER(?) AND id != ?
      - If duplicate: return 409 "A project with this name already exists"
  [10] Update Project record (name, updatedAt)
  [11] Return updated project JSON
  |
Client (onSuccess callback)
  |
  [12] projectStore: update project name in projects[]
  [13] Close RenameProjectDialog
  [14] Show success toast: "Project renamed"
  [15] If renamed project is active: header/sidebar reflects new name
```

**Error States**:

| Condition | Error Message | HTTP Status |
|-----------|--------------|-------------|
| Empty name | "Project name is required" | 400 (client-side) |
| Same name submitted | "Name unchanged" | 400 (client-side) |
| Duplicate name | "A project with this name already exists" | 409 |
| Project not found/not owned | "Project not found" | 404 |
| Server error | "Something went wrong. Please try again." | 500 |

---

## 4. Delete Project Flow

**Trigger**: User clicks delete icon on a project in ProjectSwitcher

```
Client (DeleteProjectDialog)
  |
  [1] User clicks delete icon (Trash) on a project item in ProjectSwitcher
  [2] DeleteProjectDialog opens with confirmation:
      - Title: "Delete project?"
      - Message: "This will permanently delete '{projectName}' and all its tasks.
                  This action cannot be undone."
      - Actions: [Cancel] [Delete]
  [3] User clicks "Delete"
  |
  [4] Check: is this the user's last project?
      - If yes (projects.length === 1):
        a. Create new default project first (POST /api/projects { name: "My Project" })
        b. Set new default as active
        c. Then proceed to delete the original
  |
  [5] DELETE /api/projects/[id]
  |
Server (ProjectRouteHandler -> ProjectService)
  |
  [6] Authenticate: extract userId from session
  [7] Ownership check: find project WHERE id = ? AND userId = ?
      - If not found: return 404 "Project not found"
  [8] Cascade delete:
      - Prisma onDelete: Cascade handles Task deletion
      - Tasks cascade-delete PipelineRuns
  [9] Delete Project record
  [10] Return 204 No Content
  |
Client (onSuccess callback)
  |
  [11] projectStore: remove project from projects[]
  [12] If deleted project was active:
       - Switch to first remaining project in list
       - Persist new activeProjectId to localStorage
       - taskStore.fetchTasks(newActiveProjectId)
  [13] Close DeleteProjectDialog
  [14] Show success toast: "Project deleted"
```

**Last-Project Deletion Strategy**:
- The client handles last-project prevention by creating a new default project before deleting.
- This avoids a zero-project state at any point.
- The server does NOT block deletion of the last project -- the client orchestrates the safe sequence.

**Error States**:

| Condition | Error Message | HTTP Status |
|-----------|--------------|-------------|
| Project not found/not owned | "Project not found" | 404 |
| Server error | "Something went wrong. Please try again." | 500 |

---

## 5. Default Project Creation Flow

**Trigger**: User registers or logs in for the first time (no projects exist)

```
Client (after login/registration redirect to /board)
  |
  [1] DashboardLayout mounts
  [2] projectStore.fetchProjects() called
  |
  [3] GET /api/projects
  |
Server (ProjectRouteHandler -> ProjectService)
  |
  [4] Authenticate: extract userId from session
  [5] Query: SELECT * FROM project WHERE userId = ? ORDER BY createdAt ASC
  [6] Return projects array (may be empty for new users)
  |
Client (projectStore.fetchProjects callback)
  |
  [7] If projects array is empty:
      a. Call projectStore.createProject("My Project")
      b. POST /api/projects { name: "My Project" }
      c. Server creates project, returns it
      d. projectStore: set as sole project and activeProjectId
      e. Persist activeProjectId to localStorage
  [8] If projects array is non-empty:
      a. Check localStorage for saved activeProjectId
      b. If saved ID exists in fetched projects: restore it
      c. If saved ID not found (project deleted): use first project
      d. Set activeProjectId
  [9] taskStore.fetchTasks(activeProjectId) -- load tasks for active project
  [10] Set projectStore.isLoading = false (unblocks UI render)
```

**Design Decision**: Default project creation is client-initiated (not a server-side hook in AuthService). This keeps AuthService focused on auth and avoids coupling. The client detects the zero-project state on first load and handles it.

**Note**: The UOW-01 business-logic-model references a "Post-Registration Hook" creating "My First Project" server-side. This UOW-02 design refines that: the default project name is "My Project" and creation is client-initiated on first dashboard load to simplify the auth flow. The server endpoint is the same POST /api/projects.

---

## 6. Fetch Projects Flow

**Trigger**: Dashboard mount, after project mutation

```
Client (projectStore.fetchProjects)
  |
  [1] Set isLoading = true
  [2] GET /api/projects
  |
Server (ProjectRouteHandler -> ProjectService)
  |
  [3] Authenticate: extract userId from session
  [4] Query: SELECT * FROM project WHERE userId = ? ORDER BY createdAt ASC
  [5] Return projects array
  |
Client (onSuccess callback)
  |
  [6] projectStore: set projects[]
  [7] Resolve activeProjectId (from localStorage or first project)
  [8] Set isLoading = false
```

---

## 7. Zustand Store Definition: projectStore

```
Purpose: Track user projects and active project selection

State:
  - projects: Project[]              // All projects for authenticated user
  - activeProjectId: string | null   // Currently selected project ID
  - isLoading: boolean               // True during fetchProjects
  - error: string | null             // Last error message

Actions:
  - fetchProjects(): Fetch all projects from API, populate projects[],
    resolve activeProjectId from localStorage or first project
  - createProject(name: string): POST /api/projects, add to projects[],
    set as active, persist to localStorage
  - renameProject(id: string, name: string): PATCH /api/projects/[id],
    update name in projects[]
  - deleteProject(id: string): DELETE /api/projects/[id],
    remove from projects[], handle active project switch
  - setActiveProject(id: string): Set activeProjectId,
    persist to localStorage, trigger task refetch
  - clearError(): Reset error to null

Derived State:
  - activeProject: computed from projects.find(p => p.id === activeProjectId)

Persistence:
  - activeProjectId saved to localStorage key "ac_active_project"
  - Restored on fetchProjects if the saved ID still exists in fetched list
  - If saved ID is stale (project deleted), falls back to first project

Lifecycle:
  - fetchProjects() called on dashboard mount (in useEffect or layout)
  - createProject/renameProject/deleteProject called from UI components
  - setActiveProject called from ProjectSwitcher on project selection
  - isLoading blocks board render until projects are loaded
```

---

## 8. API Route Specifications

### GET /api/projects

```
Purpose: List all projects for the authenticated user
Auth: Required (session cookie)
Query Params: none
Response 200:
  {
    projects: [
      { id, name, userId, createdAt, updatedAt },
      ...
    ]
  }
Response 401: { error: "Unauthorized" }
```

### POST /api/projects

```
Purpose: Create a new project
Auth: Required (session cookie)
Request Body:
  { name: string }
Validation:
  - name: required, 1-50 chars, trimmed
  - Unique per user (case-insensitive)
  - Max 20 projects per user
Response 201:
  { id, name, userId, createdAt, updatedAt }
Response 400: { error: "Project name is required" | "Maximum of 20 projects reached" }
Response 409: { error: "A project with this name already exists" }
Response 401: { error: "Unauthorized" }
```

### PATCH /api/projects/[id]

```
Purpose: Rename a project
Auth: Required (session cookie)
URL Params: id (project ID)
Request Body:
  { name: string }
Validation:
  - name: required, 1-50 chars, trimmed
  - Unique per user (case-insensitive, excluding current project)
  - Ownership: project must belong to authenticated user
Response 200:
  { id, name, userId, createdAt, updatedAt }
Response 400: { error: "Project name is required" }
Response 404: { error: "Project not found" }
Response 409: { error: "A project with this name already exists" }
Response 401: { error: "Unauthorized" }
```

### DELETE /api/projects/[id]

```
Purpose: Delete a project and cascade-delete all its tasks
Auth: Required (session cookie)
URL Params: id (project ID)
Validation:
  - Ownership: project must belong to authenticated user
Response 204: (no body)
Response 404: { error: "Project not found" }
Response 401: { error: "Unauthorized" }
```

---

## Process-to-Story Traceability

| Business Process | Stories Covered |
|-----------------|----------------|
| Create Project | US-007 |
| Switch Project | US-008 |
| Rename Project | US-009 |
| Delete Project | US-010 |
| Default Project Creation | US-011 |
| Fetch Projects / projectStore | (infrastructure, supports all stories) |
