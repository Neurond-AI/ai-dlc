# Code Generation Plan -- UOW-02: Project Management

## Overview

This plan defines the step-by-step implementation sequence for UOW-02 (Project Management) of the AutoCoder project. UOW-02 enables multi-project support: project CRUD operations, a project switcher in the sidebar, active project persistence via localStorage, and a default project auto-created on first login.

**Application**: AutoCoder -- Next.js 15 App Router
**Unit**: UOW-02 (Project Management)
**Stories**: US-007 through US-011
**Dependency**: UOW-01 (Foundation & Auth) must be complete
**Complexity**: Low (standard CRUD pattern on existing infrastructure)
**New Dependencies**: None (all libraries established in UOW-01)

---

## Story Reference

| Story | Title | Priority | Description |
|-------|-------|----------|-------------|
| US-007 | Create Project | Must | User creates a new project via modal with name validation |
| US-008 | Switch Between Projects | Must | User switches active project via sidebar dropdown |
| US-009 | Rename Project | Should | User renames a project via dialog with uniqueness check |
| US-010 | Delete Project | Should | User deletes a project with confirmation and cascade |
| US-011 | Default Project on First Login | Must | System auto-creates "My Project" when user has zero projects |

---

## Business Rules Reference

| Rule ID | Domain | Summary | Enforcement |
|---------|--------|---------|-------------|
| BR-02-001 | Project Name | Required, 1-50 chars, trimmed | Client + Server (Zod) |
| BR-02-002 | Project Name | Unique per user, case-insensitive | Server (DB query) |
| BR-02-003 | Ownership | User can only access own projects | Server (WHERE userId) |
| BR-02-004 | Deletion | Delete requires confirmation dialog | Client (AlertDialog) |
| BR-02-005 | Deletion | Cannot reach zero projects | Client (create default before delete) |
| BR-02-006 | Default | Default project name is "My Project" | Client (auto-creation) |
| BR-02-007 | Active Project | activeProjectId persisted in localStorage | Client (key: `ac_active_project`) |
| BR-02-008 | Limits | Maximum 20 projects per user | Server (count check) |

---

## NFR Reference

| NFR ID | Category | Requirement | Target |
|--------|----------|-------------|--------|
| NFR-02-001 | Performance | Project list API response | P95 < 200ms |
| NFR-02-002 | Performance | Project switch UI response | < 500ms |
| NFR-02-003 | Security | Ownership enforcement on all CRUD | 404 on cross-user |
| NFR-02-004 | Security | Cascade delete in single transaction | Prisma $transaction |
| NFR-02-005 | Security | Zod validation on client + server | Shared schema |
| NFR-02-006 | Reliability | Zero-project invariant | Always >= 1 project |

---

## File Map (All Files Created or Modified)

### New Files

| # | File Path | Purpose | Step |
|---|-----------|---------|------|
| 1 | `prisma/schema.prisma` | Extended with Project model (modify existing) | 1 |
| 2 | `src/lib/validators/project.ts` | Zod schemas for project name validation | 2 |
| 3 | `src/types/project.ts` | TypeScript interfaces (replaces UOW-01 stub) | 2 |
| 4 | `src/stores/project-store.ts` | Zustand store for project state + CRUD actions | 3 |
| 5 | `src/app/api/projects/route.ts` | GET (list) + POST (create) API handlers | 4 |
| 6 | `src/app/api/projects/[id]/route.ts` | PATCH (rename) + DELETE API handlers | 4 |
| 7 | `src/components/projects/project-switcher.tsx` | Popover dropdown for project selection | 5 |
| 8 | `src/components/projects/create-project-modal.tsx` | Dialog for creating a new project | 6 |
| 9 | `src/components/projects/rename-project-dialog.tsx` | Dialog for renaming a project | 7 |
| 10 | `src/components/projects/delete-project-dialog.tsx` | AlertDialog for confirming project deletion | 8 |

### Modified Files (from UOW-01)

| # | File Path | Changes | Step |
|---|-----------|---------|------|
| 11 | `src/components/layout/sidebar.tsx` | Replace static project stub with `<ProjectSwitcher />` | 9 |
| 12 | `src/components/layout/header.tsx` | Show active project name from projectStore | 9 |
| 13 | `src/app/(dashboard)/layout.tsx` | Initialize projectStore on mount, handle default project | 10 |

---

## Implementation Steps

---

### Step 1: Extend Prisma Schema -- Project Model

**Stories**: US-007, US-008, US-009, US-010, US-011 (infrastructure for all)
**Business Rules**: BR-02-002 (unique constraint), BR-02-003 (userId FK)
**NFRs**: NFR-02-001 (@@index for performance), NFR-02-004 (onDelete: Cascade)
**Depends On**: UOW-01 Prisma schema (User, Task, PipelineRun models exist)

**File**: `prisma/schema.prisma`

- [ ] **1.1** Add the `Project` model to the existing Prisma schema:
  ```prisma
  model Project {
    id        String   @id @default(cuid())
    name      String
    userId    String
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt

    user  User   @relation(fields: [userId], references: [id], onDelete: Cascade)
    tasks Task[]

    @@unique([userId, name])
    @@index([userId])
    @@map("project")
  }
  ```

- [ ] **1.2** Verify the `User` model already has `projects Project[]` relation field. If not, add it.

- [ ] **1.3** Verify the `Task` model's `project` relation field references `Project` with `onDelete: Cascade`:
  ```prisma
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  ```

- [ ] **1.4** Run `npx prisma migrate dev --name add-project-model` to generate and apply migration.

- [ ] **1.5** Add a case-insensitive unique index via a custom SQL migration:
  ```sql
  CREATE UNIQUE INDEX "project_userId_name_ci" ON "project" ("userId", LOWER("name"));
  ```
  This enforces BR-02-002 (case-insensitive uniqueness) at the database level.

- [ ] **1.6** Run `npx prisma generate` to regenerate the Prisma client.

- [ ] **1.7** Verify migration applies cleanly with `npx prisma migrate status`.

**Acceptance Criteria**:
- `Project` model exists with all fields, relations, and indexes
- Cascade delete chain: User -> Project -> Task -> PipelineRun
- Case-insensitive unique index on `(userId, LOWER(name))`
- `npx prisma studio` shows the `project` table

---

### Step 2: Zod Validators & TypeScript Types

**Stories**: US-007 (create validation), US-009 (rename validation)
**Business Rules**: BR-02-001 (name required 1-50 chars, trimmed)
**NFRs**: NFR-02-005 (shared Zod schema client + server)
**Depends On**: Step 1 (schema context)

#### 2A: TypeScript Types

**File**: `src/types/project.ts`

- [ ] **2.1** Replace the UOW-01 stub with full type definitions:
  ```ts
  /**
   * Core Project entity as returned from the API.
   */
  export interface Project {
    id: string;
    name: string;
    userId: string;
    createdAt: string;   // ISO 8601 string (serialized from Date)
    updatedAt: string;   // ISO 8601 string
  }

  /**
   * Input for creating a new project.
   */
  export interface CreateProjectInput {
    name: string;
  }

  /**
   * Input for renaming a project.
   */
  export interface RenameProjectInput {
    name: string;
  }

  /**
   * API response for GET /api/projects
   */
  export interface ProjectListResponse {
    projects: Project[];
  }

  /**
   * API error response shape
   */
  export interface ProjectErrorResponse {
    error: string;
  }
  ```

#### 2B: Zod Validation Schemas

**File**: `src/lib/validators/project.ts`

- [ ] **2.2** Create shared Zod schemas used by both client components and server API routes:
  ```ts
  import { z } from "zod";

  export const createProjectSchema = z.object({
    name: z
      .string()
      .trim()
      .min(1, "Project name is required")
      .max(50, "Project name must be 50 characters or fewer"),
  });

  export const renameProjectSchema = z.object({
    name: z
      .string()
      .trim()
      .min(1, "Project name is required")
      .max(50, "Project name must be 50 characters or fewer"),
  });

  export const projectIdSchema = z.object({
    id: z.string().min(1, "Project ID is required"),
  });

  export type CreateProjectInput = z.infer<typeof createProjectSchema>;
  export type RenameProjectInput = z.infer<typeof renameProjectSchema>;
  ```

- [ ] **2.3** Verify the schema correctly trims whitespace and enforces min/max length:
  - `" "` (whitespace only) should fail with "Project name is required" (trimmed to empty)
  - `"a".repeat(51)` should fail with "Project name must be 50 characters or fewer"
  - `"  My Project  "` should pass and trim to `"My Project"`

**Acceptance Criteria**:
- Shared schemas importable from both `src/components/` and `src/app/api/`
- Zod schema covers: required, min 1, max 50, trim
- TypeScript types match API response shapes from domain-entities spec

---

### Step 3: Zustand Project Store

**Stories**: US-007 (createProject), US-008 (setActiveProject), US-009 (renameProject), US-010 (deleteProject), US-011 (fetchProjects + default creation)
**Business Rules**: BR-02-005 (zero-project invariant), BR-02-006 (default name "My Project"), BR-02-007 (localStorage persistence), BR-02-008 (20-project limit awareness)
**NFRs**: NFR-02-002 (switch < 500ms), NFR-02-006 (zero-project invariant)
**Depends On**: Step 2 (types + validators)

**File**: `src/stores/project-store.ts`

- [ ] **3.1** Define the store interface:
  ```ts
  interface ProjectState {
    projects: Project[];
    activeProjectId: string | null;
    isLoading: boolean;
    error: string | null;
  }

  interface ProjectActions {
    fetchProjects: () => Promise<void>;
    createProject: (name: string) => Promise<Project>;
    renameProject: (id: string, name: string) => Promise<void>;
    deleteProject: (id: string) => Promise<void>;
    setActiveProject: (id: string) => void;
    clearError: () => void;
  }
  ```

- [ ] **3.2** Implement `fetchProjects()`:
  - Call `GET /api/projects`
  - Set `projects` from response
  - Resolve `activeProjectId`:
    - Read `localStorage.getItem("ac_active_project")`
    - If stored ID exists in fetched projects, use it
    - If not found (stale), fall back to first project in list
  - If projects array is empty (new user, US-011):
    - Call `createProject("My Project")` to auto-create default
    - Set as active project
  - Set `isLoading = false`
  - **BR-02-006, BR-02-007, NFR-02-006**

- [ ] **3.3** Implement `createProject(name)`:
  - Call `POST /api/projects` with `{ name }`
  - On success: add to `projects[]`, set as `activeProjectId`, persist to localStorage
  - On error: parse error response, set `error` state, rethrow for component handling
  - **BR-02-001, BR-02-002, BR-02-008 (server enforced)**

- [ ] **3.4** Implement `renameProject(id, name)`:
  - Call `PATCH /api/projects/${id}` with `{ name }`
  - On success: update project name in `projects[]`
  - On error: parse error response, set `error` state, rethrow
  - **BR-02-001, BR-02-002**

- [ ] **3.5** Implement `deleteProject(id)`:
  - Check if this is the last project (`projects.length === 1`):
    - If yes: create default project first via `createProject("My Project")`
    - Handle name collision: if "My Project" exists, try "My Project (2)", "My Project (3)", etc.
    - Set new default as active
  - Call `DELETE /api/projects/${id}`
  - On success: remove from `projects[]`
  - If deleted project was active:
    - Switch to first remaining project
    - Persist new `activeProjectId` to localStorage
  - **BR-02-004 (via component), BR-02-005, BR-02-006**

- [ ] **3.6** Implement `setActiveProject(id)`:
  - Set `activeProjectId = id`
  - Write to `localStorage.setItem("ac_active_project", id)`
  - **BR-02-007**
  - Note: task refetch will be triggered by the consuming component (UOW-03 concern)

- [ ] **3.7** Implement derived getter `activeProject`:
  - Computed as `projects.find(p => p.id === activeProjectId) ?? null`
  - Used by ProjectSwitcher trigger and Header

- [ ] **3.8** Add localStorage guard for SSR safety:
  - Wrap all `localStorage` calls in `typeof window !== "undefined"` check
  - Zustand store should only access localStorage on client

**Acceptance Criteria**:
- Store manages projects[], activeProjectId, isLoading, error
- fetchProjects handles empty state (auto-creates "My Project")
- activeProjectId persisted to and restored from localStorage
- deleteProject handles last-project invariant
- All API calls include proper error handling with typed responses

**Testing Notes**:
- Unit test fetchProjects with empty response -> verifies default creation
- Unit test deleteProject with single project -> verifies create-before-delete
- Unit test setActiveProject -> verifies localStorage write
- Unit test fetchProjects with stale localStorage ID -> verifies fallback

---

### Step 4: API Routes (Projects CRUD)

**Stories**: US-007 (POST), US-008 (GET), US-009 (PATCH), US-010 (DELETE), US-011 (POST for default)
**Business Rules**: BR-02-001, BR-02-002, BR-02-003, BR-02-008
**NFRs**: NFR-02-001 (< 200ms), NFR-02-003 (ownership), NFR-02-004 (cascade $transaction), NFR-02-005 (Zod validation)
**Depends On**: Step 1 (Prisma schema), Step 2 (Zod schemas)

#### 4A: GET /api/projects & POST /api/projects

**File**: `src/app/api/projects/route.ts`

- [ ] **4.1** Implement `GET` handler:
  - Extract `userId` from session via better-auth. If no session, return `401 { error: "Unauthorized" }`
  - Query: `prisma.project.findMany({ where: { userId }, orderBy: { createdAt: "asc" } })`
  - Return `200 { projects: [...] }`
  - **BR-02-003** (userId filter), **NFR-02-001** (indexed query)

- [ ] **4.2** Implement `POST` handler:
  - Extract `userId` from session. If no session, return `401`
  - Parse body with `createProjectSchema.safeParse()`. If invalid, return `400` with Zod error
  - **Uniqueness check (BR-02-002)**:
    ```ts
    const existing = await prisma.project.findFirst({
      where: {
        userId,
        name: { equals: name, mode: "insensitive" },
      },
    });
    if (existing) return NextResponse.json(
      { error: "A project with this name already exists" },
      { status: 409 }
    );
    ```
  - **Limit check (BR-02-008)**:
    ```ts
    const count = await prisma.project.count({ where: { userId } });
    if (count >= 20) return NextResponse.json(
      { error: "Maximum of 20 projects reached" },
      { status: 400 }
    );
    ```
  - Create project: `prisma.project.create({ data: { name, userId } })`
  - Return `201` with created project JSON
  - **BR-02-001, BR-02-002, BR-02-003, BR-02-008, NFR-02-005**

#### 4B: PATCH /api/projects/[id] & DELETE /api/projects/[id]

**File**: `src/app/api/projects/[id]/route.ts`

- [ ] **4.3** Implement `PATCH` handler:
  - Extract `userId` from session. If no session, return `401`
  - Extract `id` from route params. Validate with `projectIdSchema`
  - Parse body with `renameProjectSchema.safeParse()`. If invalid, return `400`
  - **Ownership check (BR-02-003)**:
    ```ts
    const project = await prisma.project.findFirst({
      where: { id, userId },
    });
    if (!project) return NextResponse.json(
      { error: "Project not found" },
      { status: 404 }
    );
    ```
  - **Uniqueness check (BR-02-002)** (exclude current project):
    ```ts
    const duplicate = await prisma.project.findFirst({
      where: {
        userId,
        name: { equals: name, mode: "insensitive" },
        id: { not: id },
      },
    });
    if (duplicate) return NextResponse.json(
      { error: "A project with this name already exists" },
      { status: 409 }
    );
    ```
  - Update: `prisma.project.update({ where: { id }, data: { name } })`
  - Return `200` with updated project JSON

- [ ] **4.4** Implement `DELETE` handler:
  - Extract `userId` from session. If no session, return `401`
  - Extract `id` from route params
  - **Ownership check (BR-02-003)**:
    ```ts
    const project = await prisma.project.findFirst({
      where: { id, userId },
    });
    if (!project) return NextResponse.json(
      { error: "Project not found" },
      { status: 404 }
    );
    ```
  - **Cascade delete in transaction (NFR-02-004)**:
    ```ts
    await prisma.$transaction([
      prisma.task.deleteMany({ where: { projectId: id } }),
      prisma.project.delete({ where: { id } }),
    ]);
    ```
    Note: Even though Prisma `onDelete: Cascade` exists, using an explicit `$transaction` provides guaranteed atomicity and aligns with NFR-02-004.
  - Return `204` (no body)

- [ ] **4.5** Add consistent error handling wrapper for all routes:
  - Catch unexpected errors, log them server-side
  - Return `500 { error: "Something went wrong. Please try again." }`
  - Never expose internal error details to client

**Acceptance Criteria**:
- All four endpoints authenticate via session
- Ownership enforced on every operation (returns 404, not 403)
- Zod validation on POST and PATCH bodies
- Case-insensitive uniqueness check on create and rename
- 20-project limit enforced on create
- Cascade delete uses $transaction
- Correct HTTP status codes: 200, 201, 204, 400, 401, 404, 409, 500

**Testing Notes**:
- Test 401 for unauthenticated requests
- Test 404 for accessing another user's project
- Test 409 for duplicate project name (case-insensitive: "Test" vs "test")
- Test 400 for empty name, name > 50 chars, and project limit
- Test cascade delete removes associated tasks
- Test $transaction rollback on partial failure

---

### Step 5: ProjectSwitcher Component

**Stories**: US-007 (triggers CreateProjectModal), US-008 (project switching), US-009 (triggers RenameProjectDialog), US-010 (triggers DeleteProjectDialog)
**Business Rules**: BR-02-003 (shows only user's projects), BR-02-007 (active project from store)
**Depends On**: Step 3 (projectStore)

**File**: `src/components/projects/project-switcher.tsx`

- [ ] **5.1** Create client component (`"use client"`) using shadcn/ui `Popover`:
  - Import: `Popover`, `PopoverTrigger`, `PopoverContent` from `@/components/ui/popover`
  - Import: `Separator` from `@/components/ui/separator`
  - Import: `Button` from `@/components/ui/button`
  - Import icons: `ChevronDown`, `Check`, `Pencil`, `Trash2`, `Plus`, `FolderOpen` from `lucide-react`

- [ ] **5.2** Define internal state:
  ```ts
  const [isOpen, setIsOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [renameProject, setRenameProject] = useState<{ id: string; name: string } | null>(null);
  const [deleteProject, setDeleteProject] = useState<{ id: string; name: string } | null>(null);
  ```

- [ ] **5.3** Read from projectStore:
  ```ts
  const { projects, activeProjectId, activeProject, setActiveProject } = useProjectStore();
  ```

- [ ] **5.4** Build the trigger button:
  - Display `activeProject?.name` truncated with ellipsis (max sidebar width)
  - Show `ChevronDown` icon to indicate dropdown
  - Collapsed sidebar: show only `FolderOpen` icon with tooltip showing active project name

- [ ] **5.5** Build the dropdown content:
  - Header label: "Projects" (muted, small text)
  - Scrollable project list (max height for overflow with 20 projects)
  - Each project item:
    - `Check` icon if active (otherwise spacer for alignment)
    - Project name (truncated)
    - `Pencil` icon button on hover -> opens RenameProjectDialog
    - `Trash2` icon button on hover -> opens DeleteProjectDialog
  - `Separator` divider
  - "New Project" button with `Plus` icon at bottom

- [ ] **5.6** Handle project selection:
  - On click project item: call `setActiveProject(id)`, close popover
  - Do NOT close popover when clicking edit/delete icons (modals open on top)

- [ ] **5.7** Render child dialogs (conditionally):
  ```tsx
  <CreateProjectModal
    isOpen={isCreateModalOpen}
    onClose={() => setIsCreateModalOpen(false)}
  />
  {renameProject && (
    <RenameProjectDialog
      projectId={renameProject.id}
      currentName={renameProject.name}
      isOpen={true}
      onClose={() => setRenameProject(null)}
    />
  )}
  {deleteProject && (
    <DeleteProjectDialog
      projectId={deleteProject.id}
      projectName={deleteProject.name}
      isLastProject={projects.length === 1}
      isOpen={true}
      onClose={() => setDeleteProject(null)}
    />
  )}
  ```

- [ ] **5.8** Add `data-testid` attributes:

  | Element | data-testid |
  |---------|-------------|
  | Popover trigger button | `project-switcher-trigger` |
  | Popover dropdown content | `project-switcher-dropdown` |
  | Individual project item | `project-item-{id}` |
  | Active project checkmark | `project-active-check-{id}` |
  | Edit icon button | `project-edit-{id}` |
  | Delete icon button | `project-delete-{id}` |
  | "New Project" button | `project-create-button` |

**Acceptance Criteria**:
- Dropdown lists all user projects with active project highlighted
- Clicking a project switches active project and closes dropdown
- Edit/delete icons visible on hover, open respective dialogs
- "New Project" button opens CreateProjectModal
- Responsive: full name on expanded sidebar, icon-only on collapsed

---

### Step 6: CreateProjectModal Component

**Stories**: US-007 (Create Project)
**Business Rules**: BR-02-001 (name validation), BR-02-002 (uniqueness -- server), BR-02-008 (limit -- server)
**NFRs**: NFR-02-005 (Zod validation client-side)
**Depends On**: Step 2 (Zod schemas), Step 3 (projectStore.createProject)

**File**: `src/components/projects/create-project-modal.tsx`

- [ ] **6.1** Create client component with shadcn/ui `Dialog`:
  - Props: `isOpen: boolean`, `onClose: () => void`
  - Internal state: `name`, `error`, `isSubmitting`

- [ ] **6.2** Build the modal UI:
  - Title: "Create project"
  - Input: label "Project name", placeholder "Enter project name", auto-focused
  - Error message below input (red text, `text-sm text-destructive`)
  - Footer: Cancel button (`variant="outline"`) + Create button (loading spinner when submitting)

- [ ] **6.3** Implement form submission:
  ```ts
  const handleSubmit = async () => {
    // Client-side Zod validation
    const result = createProjectSchema.safeParse({ name });
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await projectStore.createProject(result.data.name);
      toast.success("Project created");
      onClose();
    } catch (err) {
      // Extract server error message
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };
  ```

- [ ] **6.4** Handle Enter key submission and Escape key close.

- [ ] **6.5** Reset state (name, error) when modal opens or closes.

- [ ] **6.6** Add `data-testid` attributes:

  | Element | data-testid |
  |---------|-------------|
  | Dialog container | `create-project-modal` |
  | Name input | `create-project-name-input` |
  | Error message | `create-project-error` |
  | Cancel button | `create-project-cancel` |
  | Create/submit button | `create-project-submit` |

**Acceptance Criteria**:
- Modal opens with empty, auto-focused name input
- Client-side validation: empty name and >50 char name show inline error
- Server errors (409 duplicate, 400 limit) displayed below input
- On success: toast "Project created", modal closes, new project becomes active
- Submit disabled while `isSubmitting`

---

### Step 7: RenameProjectDialog Component

**Stories**: US-009 (Rename Project)
**Business Rules**: BR-02-001 (name validation), BR-02-002 (uniqueness -- server)
**NFRs**: NFR-02-005 (Zod validation client-side)
**Depends On**: Step 2 (Zod schemas), Step 3 (projectStore.renameProject)

**File**: `src/components/projects/rename-project-dialog.tsx`

- [ ] **7.1** Create client component with shadcn/ui `Dialog`:
  - Props: `projectId: string`, `currentName: string`, `isOpen: boolean`, `onClose: () => void`
  - Internal state: `name` (initialized to `currentName`), `error`, `isSubmitting`

- [ ] **7.2** Build the dialog UI:
  - Title: "Rename project"
  - Input: label "Project name", pre-filled with `currentName`, auto-focused with text selected
  - Error message below input (red text)
  - Footer: Cancel button + Rename button (with loading spinner)

- [ ] **7.3** Implement form submission:
  ```ts
  const handleSubmit = async () => {
    // Check if name unchanged
    if (name.trim() === currentName) {
      setError("Name unchanged");
      return;
    }

    // Client-side Zod validation
    const result = renameProjectSchema.safeParse({ name });
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await projectStore.renameProject(projectId, result.data.name);
      toast.success("Project renamed");
      onClose();
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };
  ```

- [ ] **7.4** Re-initialize `name` to `currentName` when dialog opens (handle prop changes via `useEffect`).

- [ ] **7.5** Handle Enter key submission and Escape key close.

- [ ] **7.6** Add `data-testid` attributes:

  | Element | data-testid |
  |---------|-------------|
  | Dialog container | `rename-project-dialog` |
  | Name input | `rename-project-name-input` |
  | Error message | `rename-project-error` |
  | Cancel button | `rename-project-cancel` |
  | Submit button | `rename-project-submit` |

**Acceptance Criteria**:
- Dialog opens with current name pre-filled and text selected
- "Name unchanged" error if submitted without changes
- Client-side Zod validation for empty / too long names
- Server error (409 duplicate) displayed inline
- On success: toast "Project renamed", dialog closes, name updated in sidebar

---

### Step 8: DeleteProjectDialog Component

**Stories**: US-010 (Delete Project)
**Business Rules**: BR-02-004 (confirmation required), BR-02-005 (zero-project invariant), BR-02-006 (default name)
**NFRs**: NFR-02-006 (zero-project invariant)
**Depends On**: Step 3 (projectStore.deleteProject)

**File**: `src/components/projects/delete-project-dialog.tsx`

- [ ] **8.1** Create client component with shadcn/ui `AlertDialog`:
  - Props: `projectId: string`, `projectName: string`, `isLastProject: boolean`, `isOpen: boolean`, `onClose: () => void`
  - Internal state: `isDeleting`, `error`

- [ ] **8.2** Build the AlertDialog UI:
  - Title: "Delete project?"
  - Description: "This will permanently delete **{projectName}** and all its tasks. This action cannot be undone."
  - If `isLastProject`: additional note below description: "A new default project will be created automatically."
  - Footer: Cancel button (`variant="outline"`) + Delete button (`variant="destructive"`, loading spinner)

- [ ] **8.3** Implement deletion:
  ```ts
  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await projectStore.deleteProject(projectId);
      toast.success("Project deleted");
      onClose();
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };
  ```
  Note: The zero-project invariant (BR-02-005) is handled inside `projectStore.deleteProject` (Step 3.5), not in this component.

- [ ] **8.4** Show error message if delete fails (below description, red text).

- [ ] **8.5** Add `data-testid` attributes:

  | Element | data-testid |
  |---------|-------------|
  | AlertDialog container | `delete-project-dialog` |
  | Dialog title | `delete-project-title` |
  | Dialog description | `delete-project-description` |
  | Last-project note | `delete-project-last-note` |
  | Error message | `delete-project-error` |
  | Cancel button | `delete-project-cancel` |
  | Delete/confirm button | `delete-project-confirm` |

**Acceptance Criteria**:
- Confirmation dialog shows project name and warning about cascade deletion
- Last-project scenario shows additional note about auto-created default
- Delete button is destructive variant with loading state
- On success: toast "Project deleted", dialog closes
- On error: error message displayed in dialog

---

### Step 9: Update Sidebar and Header

**Stories**: US-008 (project switching visible in sidebar/header)
**Business Rules**: BR-02-007 (active project reflected in UI)
**Depends On**: Steps 5-8 (ProjectSwitcher and all dialogs), Step 3 (projectStore)

#### 9A: Update Sidebar

**File**: `src/components/layout/sidebar.tsx`

- [ ] **9.1** Import `ProjectSwitcher` from `@/components/projects/project-switcher`.

- [ ] **9.2** Replace the static project name stub (UOW-01 placeholder) with `<ProjectSwitcher />`:
  - Location: sidebar footer area, above the collapse toggle button
  - The static text "My Project" or similar placeholder from UOW-01 is removed

- [ ] **9.3** Verify sidebar responsive behavior:
  - Expanded sidebar: ProjectSwitcher shows full project name in trigger
  - Collapsed sidebar: ProjectSwitcher shows only `FolderOpen` icon with tooltip

#### 9B: Update Header

**File**: `src/components/layout/header.tsx`

- [ ] **9.4** Import `useProjectStore` from `@/stores/project-store`.

- [ ] **9.5** Replace static project name in header center section:
  ```tsx
  const { activeProject, isLoading } = useProjectStore();

  // In the center section:
  {isLoading ? (
    <Skeleton className="h-5 w-32" />
  ) : (
    <span className="text-sm font-medium truncate">
      {activeProject?.name}
    </span>
  )}
  ```

- [ ] **9.6** Add `data-testid` attributes:

  | Element | data-testid |
  |---------|-------------|
  | Active project name in header | `header-project-name` |
  | Loading skeleton in header | `header-project-skeleton` |

**Acceptance Criteria**:
- Sidebar footer shows ProjectSwitcher instead of static text
- Header center shows active project name (or skeleton while loading)
- Project name updates instantly when switching projects
- Responsive behavior preserved for both sidebar and header

---

### Step 10: Default Project Auto-Creation (Dashboard Layout)

**Stories**: US-011 (Default Project on First Login)
**Business Rules**: BR-02-005 (zero-project invariant), BR-02-006 (default name "My Project"), BR-02-007 (active project persistence)
**NFRs**: NFR-02-006 (always >= 1 project)
**Depends On**: Step 3 (projectStore.fetchProjects), Step 4 (API routes)

**File**: `src/app/(dashboard)/layout.tsx`

- [ ] **10.1** Add projectStore initialization to the dashboard layout mount sequence:
  ```tsx
  "use client";

  import { useProjectStore } from "@/stores/project-store";
  import { useEffect } from "react";

  export default function DashboardLayout({ children }) {
    const { fetchProjects, isLoading } = useProjectStore();

    useEffect(() => {
      fetchProjects();
    }, [fetchProjects]);

    // ... existing auth guard and layout rendering
  }
  ```
  Note: `fetchProjects()` internally handles the zero-project case by auto-creating "My Project" (implemented in Step 3.2).

- [ ] **10.2** Ensure the layout blocks child rendering until `isLoading` is false:
  ```tsx
  if (isLoading) {
    return <LoadingScreen />; // Or skeleton of AppShell
  }
  return <AppShell>{children}</AppShell>;
  ```
  This prevents child components from rendering before `activeProjectId` is resolved (avoids flicker or null-reference errors).

- [ ] **10.3** Verify the initialization sequence:
  1. `authStore.hydrate()` (from UOW-01)
  2. `projectStore.fetchProjects()` (new in UOW-02)
  3. If projects empty -> auto-create "My Project"
  4. Resolve `activeProjectId` from localStorage or first project
  5. Render AppShell + children

- [ ] **10.4** Add `data-testid` for the loading state:

  | Element | data-testid |
  |---------|-------------|
  | Dashboard loading screen | `dashboard-loading` |

**Acceptance Criteria**:
- New user navigating to dashboard sees "My Project" auto-created
- Returning user sees their projects loaded with previously active project restored
- No child routes render until projectStore is initialized
- No flicker or empty state visible during project initialization

---

### Step 11: Unit Tests

**Stories**: All (US-007 through US-011)
**Business Rules**: All (BR-02-001 through BR-02-008)
**NFRs**: NFR-02-003 (ownership), NFR-02-005 (validation), NFR-02-006 (zero-project)
**Depends On**: Steps 1-10 (all implementation complete)

#### 11A: Zod Schema Tests

**File**: `src/lib/validators/__tests__/project.test.ts`

- [ ] **11.1** Test `createProjectSchema`:
  - Valid: "My Project" -> passes
  - Valid: "A" (min 1 char) -> passes
  - Valid: 50-char string -> passes
  - Valid: "  Trimmed  " -> passes and trims to "Trimmed"
  - Invalid: "" (empty) -> "Project name is required"
  - Invalid: "   " (whitespace only) -> "Project name is required" (trimmed to empty)
  - Invalid: 51-char string -> "Project name must be 50 characters or fewer"

- [ ] **11.2** Test `renameProjectSchema` (same constraints as create).

- [ ] **11.3** Test `projectIdSchema`:
  - Valid: "clxyz123..." -> passes
  - Invalid: "" -> "Project ID is required"

#### 11B: Project Store Tests

**File**: `src/stores/__tests__/project-store.test.ts`

- [ ] **11.4** Test `fetchProjects` with non-empty response:
  - Mock `GET /api/projects` returning 3 projects
  - Verify `projects` state populated
  - Verify `activeProjectId` resolved from localStorage (mock)
  - Verify `isLoading` transitions from `true` to `false`

- [ ] **11.5** Test `fetchProjects` with empty response (US-011):
  - Mock `GET /api/projects` returning empty array
  - Mock `POST /api/projects` for default creation
  - Verify "My Project" created and set as active
  - Verify localStorage written

- [ ] **11.6** Test `fetchProjects` with stale localStorage:
  - Mock `GET /api/projects` returning projects
  - Set localStorage to a non-existent project ID
  - Verify fallback to first project in list

- [ ] **11.7** Test `createProject`:
  - Mock `POST /api/projects` success
  - Verify project added to `projects[]`
  - Verify set as `activeProjectId`
  - Verify localStorage updated

- [ ] **11.8** Test `renameProject`:
  - Mock `PATCH /api/projects/[id]` success
  - Verify project name updated in `projects[]`

- [ ] **11.9** Test `deleteProject` (non-last):
  - Start with 2 projects, active on first
  - Mock `DELETE /api/projects/[id]` success
  - Verify project removed from `projects[]`
  - Verify `activeProjectId` switches to remaining project

- [ ] **11.10** Test `deleteProject` (last project -- BR-02-005):
  - Start with 1 project
  - Mock `POST /api/projects` for default creation
  - Mock `DELETE /api/projects/[id]` success
  - Verify new "My Project" created before delete
  - Verify new project is active after delete

- [ ] **11.11** Test `setActiveProject`:
  - Call with a valid project ID
  - Verify `activeProjectId` updated
  - Verify `localStorage.setItem("ac_active_project", id)` called

#### 11C: API Route Tests

**File**: `src/app/api/projects/__tests__/route.test.ts`

- [ ] **11.12** Test `GET /api/projects`:
  - Authenticated user -> returns their projects (200)
  - Unauthenticated -> returns 401

- [ ] **11.13** Test `POST /api/projects`:
  - Valid name -> creates project (201)
  - Empty name -> 400 Zod error
  - Duplicate name (case-insensitive) -> 409
  - 20th project already exists -> 400 limit error
  - Unauthenticated -> 401

- [ ] **11.14** Test `PATCH /api/projects/[id]`:
  - Own project, valid name -> renames (200)
  - Another user's project -> 404 (not 403)
  - Duplicate name -> 409
  - Unauthenticated -> 401

- [ ] **11.15** Test `DELETE /api/projects/[id]`:
  - Own project -> deletes with cascade (204)
  - Another user's project -> 404
  - Verify tasks cascade-deleted (query tasks table after delete)
  - Unauthenticated -> 401

#### 11D: Component Tests

**File**: `src/components/projects/__tests__/project-switcher.test.tsx`

- [ ] **11.16** Test ProjectSwitcher renders all projects from store.

- [ ] **11.17** Test clicking a project calls `setActiveProject` and closes dropdown.

- [ ] **11.18** Test "New Project" button opens CreateProjectModal.

- [ ] **11.19** Test edit icon opens RenameProjectDialog with correct props.

- [ ] **11.20** Test delete icon opens DeleteProjectDialog with correct props.

**File**: `src/components/projects/__tests__/create-project-modal.test.tsx`

- [ ] **11.21** Test empty name shows validation error.

- [ ] **11.22** Test successful creation shows toast and closes modal.

- [ ] **11.23** Test server 409 error displayed inline.

**File**: `src/components/projects/__tests__/rename-project-dialog.test.tsx`

- [ ] **11.24** Test dialog pre-fills with current name.

- [ ] **11.25** Test unchanged name shows "Name unchanged" error.

- [ ] **11.26** Test successful rename shows toast and closes dialog.

**File**: `src/components/projects/__tests__/delete-project-dialog.test.tsx`

- [ ] **11.27** Test confirmation dialog shows project name in warning.

- [ ] **11.28** Test `isLastProject` shows additional note.

- [ ] **11.29** Test successful deletion shows toast and closes dialog.

**Acceptance Criteria**:
- All Zod schemas tested for valid and invalid inputs
- Project store tested for all actions including edge cases
- API routes tested for auth, validation, uniqueness, limits, ownership
- Component tests verify user interactions, error states, and success flows
- All `data-testid` attributes used in test selectors

---

### Step 12: Documentation Summary

**Stories**: All (US-007 through US-011)
**Depends On**: Steps 1-11 (all implementation and tests complete)

- [ ] **12.1** Update `aidlc-docs/construction/plans/` with implementation status.

- [ ] **12.2** Create a brief implementation notes file documenting:
  - Any deviations from the functional design
  - Any additional edge cases discovered during implementation
  - Performance observations (API response times)
  - Migration notes (schema changes, index additions)

- [ ] **12.3** Verify all files created/modified match the file map in this plan.

- [ ] **12.4** Verify all user stories are covered by at least one implementation step and one test.

---

## Traceability Matrix

### Story-to-Step Mapping

| Story | Title | Steps |
|-------|-------|-------|
| US-007 | Create Project | 1, 2, 3.3, 4.2, 5, 6, 11.13, 11.21-11.23 |
| US-008 | Switch Between Projects | 3.6, 4.1, 5, 9, 11.4, 11.11, 11.16-11.17 |
| US-009 | Rename Project | 2, 3.4, 4.3, 5, 7, 11.14, 11.24-11.26 |
| US-010 | Delete Project | 3.5, 4.4, 5, 8, 11.9-11.10, 11.15, 11.27-11.29 |
| US-011 | Default Project on First Login | 3.2, 10, 11.5 |

### Business Rule-to-Step Mapping

| Rule | Steps | Enforcement Point |
|------|-------|-------------------|
| BR-02-001 | 2.2, 6.3, 7.3 | Zod schema (client + server) |
| BR-02-002 | 1.5, 4.2, 4.3 | Server API + DB index |
| BR-02-003 | 4.1, 4.2, 4.3, 4.4 | Server API (WHERE userId) |
| BR-02-004 | 8.2 | Client (AlertDialog) |
| BR-02-005 | 3.5, 8.1 | Client (store + component) |
| BR-02-006 | 3.2, 3.5 | Client (store logic) |
| BR-02-007 | 3.2, 3.6, 9 | Client (localStorage) |
| BR-02-008 | 4.2 | Server API (count check) |

### NFR-to-Step Mapping

| NFR | Steps | Verification |
|-----|-------|-------------|
| NFR-02-001 | 1.1 (@@index), 4.1 | P95 < 200ms via indexed query |
| NFR-02-002 | 3.6, 5.6 | < 500ms (no API call on switch) |
| NFR-02-003 | 4.1-4.4, 11.14-11.15 | 404 on cross-user, tested |
| NFR-02-004 | 4.4, 11.15 | $transaction, tested |
| NFR-02-005 | 2.2, 4.2, 4.3, 6.3, 7.3 | Shared Zod schema, tested |
| NFR-02-006 | 3.2, 3.5, 10, 11.5, 11.10 | Zero-project invariant, tested |

---

## Complete data-testid Reference

| data-testid | Component | Purpose |
|-------------|-----------|---------|
| `project-switcher-trigger` | ProjectSwitcher | Popover trigger button |
| `project-switcher-dropdown` | ProjectSwitcher | Popover dropdown content |
| `project-item-{id}` | ProjectSwitcher | Individual project row |
| `project-active-check-{id}` | ProjectSwitcher | Active project checkmark |
| `project-edit-{id}` | ProjectSwitcher | Edit icon button per project |
| `project-delete-{id}` | ProjectSwitcher | Delete icon button per project |
| `project-create-button` | ProjectSwitcher | "New Project" button |
| `create-project-modal` | CreateProjectModal | Dialog container |
| `create-project-name-input` | CreateProjectModal | Name text input |
| `create-project-error` | CreateProjectModal | Error message text |
| `create-project-cancel` | CreateProjectModal | Cancel button |
| `create-project-submit` | CreateProjectModal | Create/submit button |
| `rename-project-dialog` | RenameProjectDialog | Dialog container |
| `rename-project-name-input` | RenameProjectDialog | Name text input |
| `rename-project-error` | RenameProjectDialog | Error message text |
| `rename-project-cancel` | RenameProjectDialog | Cancel button |
| `rename-project-submit` | RenameProjectDialog | Rename/submit button |
| `delete-project-dialog` | DeleteProjectDialog | AlertDialog container |
| `delete-project-title` | DeleteProjectDialog | Dialog title |
| `delete-project-description` | DeleteProjectDialog | Warning description |
| `delete-project-last-note` | DeleteProjectDialog | Last-project auto-create note |
| `delete-project-error` | DeleteProjectDialog | Error message text |
| `delete-project-cancel` | DeleteProjectDialog | Cancel button |
| `delete-project-confirm` | DeleteProjectDialog | Delete/confirm button |
| `header-project-name` | Header | Active project name display |
| `header-project-skeleton` | Header | Loading skeleton placeholder |
| `dashboard-loading` | DashboardLayout | Full-page loading state |

---

## Execution Notes

### Prerequisites Checklist
- [ ] UOW-01 is fully implemented and passing all tests
- [ ] PostgreSQL is running via Docker Compose
- [ ] Prisma schema has User, Task, PipelineRun models
- [ ] better-auth session middleware is functional
- [ ] shadcn/ui components installed: Dialog, AlertDialog, Button, Input, Sonner
- [ ] Popover component added via `npx shadcn@latest add popover` (if not already present)
- [ ] Zustand installed and authStore/uiStore operational

### Execution Order
Steps MUST be executed in order (1 through 12). Each step depends on the artifacts produced by prior steps:
- Steps 1-2: Data layer (schema, types, validators) -- no UI dependencies
- Step 3: State management (store) -- depends on types
- Step 4: API routes -- depends on schema + validators
- Steps 5-8: UI components -- depend on store + validators
- Step 9: Integration into existing layout -- depends on all components
- Step 10: Initialization flow -- depends on store + API routes
- Step 11: Tests -- depends on all implementation
- Step 12: Documentation -- depends on everything

### Estimated LOC per File
| File | Estimated Lines |
|------|----------------|
| `prisma/schema.prisma` (additions) | ~15 |
| `src/types/project.ts` | ~35 |
| `src/lib/validators/project.ts` | ~30 |
| `src/stores/project-store.ts` | ~150 |
| `src/app/api/projects/route.ts` | ~100 |
| `src/app/api/projects/[id]/route.ts` | ~100 |
| `src/components/projects/project-switcher.tsx` | ~180 |
| `src/components/projects/create-project-modal.tsx` | ~100 |
| `src/components/projects/rename-project-dialog.tsx` | ~110 |
| `src/components/projects/delete-project-dialog.tsx` | ~90 |
| `src/components/layout/sidebar.tsx` (changes) | ~10 |
| `src/components/layout/header.tsx` (changes) | ~15 |
| `src/app/(dashboard)/layout.tsx` (changes) | ~15 |
| Test files (combined) | ~500 |
| **Total** | **~1,450** |
