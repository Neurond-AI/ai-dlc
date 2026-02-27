# Tech Stack Decisions -- UOW-02: Project Management

## Overview

Technology decisions specific to UOW-02. This unit introduces **no new dependencies** -- all required libraries are already established in the UOW-01 baseline tech stack.

---

## Baseline Reference

All technologies used in UOW-02 are covered by UOW-01 tech stack decisions (`aidlc-docs/construction/foundation-auth/nfr-requirements/tech-stack-decisions.md`):

| Technology | UOW-02 Usage |
|-----------|-------------|
| Next.js 15 (App Router) | API routes: `GET/POST /api/projects`, `PATCH/DELETE /api/projects/[id]` |
| Prisma 6 | ProjectService queries with ownership filter, `$transaction` for cascade delete |
| Zod 3 | `project-schemas.ts` -- createProjectSchema, renameProjectSchema |
| Zustand 5 | `projectStore` -- project list, activeProjectId, CRUD actions |
| shadcn/ui | Popover (ProjectSwitcher dropdown), Dialog (create/rename/delete modals), Input (project name field) |
| Tailwind CSS 4 | Styling for ProjectSwitcher component |
| Lucide React | Icons: `FolderPlus`, `ChevronDown`, `Pencil`, `Trash2`, `Check` |
| better-auth | Session validation on all project API routes |

---

## New Dependencies

**None.**

UOW-02 is a standard CRUD unit using existing infrastructure. No additional npm packages required.

---

## Component Reuse

All UI primitives reused from shadcn/ui (installed in UOW-01):

| shadcn/ui Component | UOW-02 Usage |
|---------------------|-------------|
| `Popover` + `PopoverTrigger` + `PopoverContent` | ProjectSwitcher dropdown in Sidebar |
| `Dialog` + `DialogContent` + `DialogHeader` + `DialogFooter` | Create, rename, and delete project modals |
| `Input` | Project name input field |
| `Button` | Modal actions (Create, Rename, Delete, Cancel) |
| `Tooltip` | Collapsed sidebar project icon tooltip |

No new shadcn/ui components need to be added for UOW-02.
