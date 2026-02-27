# Business Rules -- UOW-02: Project Management

## Overview

All business rules for UOW-02 are listed below with unique IDs (BR-02-XXX), rule statement, validation logic, and error messages. Rules are grouped by domain: Project Name, Ownership, Limits, Active Project, Default Project.

---

## Project Name Rules

### BR-02-001: Project Name Required

| Field | Value |
|-------|-------|
| **Rule** | Project name is required and must be 1-50 characters |
| **Validation** | Zod `z.string().min(1).max(50).trim()`. Leading/trailing whitespace trimmed before validation and storage. |
| **Error Message** | Empty: "Project name is required" / Too long: "Project name must be 50 characters or fewer" |
| **Enforcement** | Client-side (CreateProjectModal, RenameProjectDialog inline validation), Server-side (Zod schema in API route) |
| **Stories** | US-007, US-009 |

### BR-02-002: Project Name Unique Per User (Case-Insensitive)

| Field | Value |
|-------|-------|
| **Rule** | Project name must be unique per user, compared case-insensitively |
| **Validation** | Server-side: query `WHERE userId = ? AND LOWER(name) = LOWER(?)`. For rename, exclude current project from check (`AND id != ?`). Database index: `@@unique([userId, name])` with a PostgreSQL expression index on `LOWER(name)` for case-insensitive enforcement. |
| **Error Message** | "A project with this name already exists" |
| **Enforcement** | Server-side (ProjectService uniqueness check before create/rename) |
| **Stories** | US-007, US-009 |

---

## Ownership Rules

### BR-02-003: User Can Only Access Own Projects

| Field | Value |
|-------|-------|
| **Rule** | All project operations (list, get, rename, delete) must verify ownership -- user can only access projects where `userId` matches authenticated session user |
| **Validation** | Every ProjectService method includes `WHERE userId = sessionUserId` in its query. No project ID-only lookups. If project not found for user, return 404 (does not leak whether project exists for another user). |
| **Error Message** | "Project not found" |
| **Enforcement** | Server-side (ProjectService ownership check on every operation) |
| **Stories** | US-007, US-008, US-009, US-010 |

---

## Deletion Rules

### BR-02-004: Delete Requires Confirmation

| Field | Value |
|-------|-------|
| **Rule** | Project deletion requires explicit user confirmation via a dialog |
| **Validation** | Client-side: DeleteProjectDialog with warning message must be confirmed before DELETE request is sent. No single-click deletion. |
| **Error Message** | N/A (UX rule -- dialog shows: "This will permanently delete '{name}' and all its tasks. This action cannot be undone.") |
| **Enforcement** | Client-side (DeleteProjectDialog component) |
| **Stories** | US-010 |

### BR-02-005: Cannot Reach Zero Projects

| Field | Value |
|-------|-------|
| **Rule** | User must always have at least one project. When deleting the last project, a new default project ("My Project") is created first, then the original is deleted. |
| **Validation** | Client-side: before sending DELETE for the last project (`projects.length === 1`), create a new default project via POST, set it as active, then proceed with DELETE. The user sees a seamless transition. Server does not block last-project deletion -- the client orchestrates the safe sequence. |
| **Error Message** | N/A (handled transparently; user sees "Project deleted" toast and the new default project appears) |
| **Enforcement** | Client-side (projectStore.deleteProject logic) |
| **Stories** | US-010, US-011 |

---

## Default Project Rules

### BR-02-006: Default Project Name

| Field | Value |
|-------|-------|
| **Rule** | Default project name is "My Project" |
| **Validation** | Used in two contexts: (1) first login when no projects exist, (2) last-project deletion fallback. In both cases, the name "My Project" is used. If "My Project" already exists (unlikely in context 1, possible in context 2), uniqueness check will fail -- in that case, append a number suffix: "My Project (2)", etc. |
| **Error Message** | N/A (auto-creation, no user input) |
| **Enforcement** | Client-side (projectStore.fetchProjects empty-state handler, projectStore.deleteProject last-project handler) |
| **Stories** | US-011 |

---

## Active Project Rules

### BR-02-007: Active Project Persisted in localStorage

| Field | Value |
|-------|-------|
| **Rule** | The active project ID is persisted in localStorage and restored on page load |
| **Validation** | On project switch: write `activeProjectId` to localStorage key `ac_active_project`. On dashboard mount (fetchProjects): read from localStorage. If the stored ID exists in the fetched projects list, use it. If not found (project deleted, different device), fall back to the first project in the list. |
| **Error Message** | N/A (silent fallback) |
| **Enforcement** | Client-side (projectStore persistence logic) |
| **Stories** | US-008 |

---

## Limit Rules

### BR-02-008: Maximum 20 Projects Per User

| Field | Value |
|-------|-------|
| **Rule** | A user can have a maximum of 20 projects |
| **Validation** | Server-side: before creating a project, count existing projects for the user. If count >= 20, reject with 400. Client-side: optionally disable "New Project" button and show tooltip when limit is reached. |
| **Error Message** | "Maximum of 20 projects reached" |
| **Enforcement** | Server-side (ProjectService.createProject count check), Client-side (optional UX hint) |
| **Stories** | US-007 |

---

## Rules Summary Matrix

| Rule ID | Domain | Type | Enforcement |
|---------|--------|------|------------|
| BR-02-001 | Project Name | Input validation | Client + Server |
| BR-02-002 | Project Name | Uniqueness constraint | Server (DB) |
| BR-02-003 | Ownership | Access control | Server |
| BR-02-004 | Deletion | UX confirmation | Client |
| BR-02-005 | Deletion | Invariant (min 1 project) | Client |
| BR-02-006 | Default | Naming convention | Client |
| BR-02-007 | Active Project | Persistence | Client (localStorage) |
| BR-02-008 | Limits | Resource limit | Server + Client |
