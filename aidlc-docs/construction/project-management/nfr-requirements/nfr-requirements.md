# NFR Requirements -- UOW-02: Project Management

## Overview

Non-functional requirements specific to UOW-02: project CRUD, project switcher, default project auto-creation, and active project persistence. Each NFR has a unique ID (NFR-02-XXX), measurable target, verification method, and SECURITY rule mapping where applicable.

**Baseline**: UOW-01 NFRs (NFR-01-001 through NFR-01-023) cover the shared tech stack, security headers, auth, structured logging, TypeScript strict, Zod validation patterns, responsive layout, toast notifications, and keyboard navigation. This document covers **additional concerns specific to UOW-02 only**.

---

## Performance

### NFR-02-001: Project List API Response Time

| Field | Value |
|-------|-------|
| **Category** | Performance |
| **Requirement** | GET /api/projects must respond within 200ms |
| **Metric/Target** | P95 response time < 200ms for authenticated project list requests. Measured with up to 20 projects per user (BR-02-008 limit). |
| **SECURITY Mapping** | N/A |
| **Verification** | Send 20 consecutive GET /api/projects requests via browser DevTools Network tab. P95 must be under 200ms. Prisma query should use indexed `userId` column. Verify no N+1 queries via Prisma query log (`prisma.$on('query')`). |

### NFR-02-002: Project Switch UI Response Time

| Field | Value |
|-------|-------|
| **Category** | Performance |
| **Requirement** | Project switch (dropdown selection -> UI update + task refetch) must complete within 500ms |
| **Metric/Target** | From click on project in ProjectSwitcher to fully rendered task board for new project < 500ms. Includes: projectStore.setActiveProject, taskStore.fetchTasks, and board re-render. |
| **SECURITY Mapping** | N/A |
| **Verification** | Use React Profiler or Performance API. Switch between two projects with ~50 tasks each. Measure from click event to last board re-render completion. Must be under 500ms. No full page reload on project switch. |

---

## Security

### NFR-02-003: Project Ownership Enforcement

| Field | Value |
|-------|-------|
| **Category** | Security |
| **Requirement** | All project operations must enforce ownership check -- user can only access projects where `userId` matches authenticated session user |
| **Metric/Target** | Every ProjectService method (list, get, create, rename, delete) includes `WHERE userId = sessionUserId`. Unauthorized access to another user's project returns 404 (not 403, to prevent enumeration). Zero cross-user data leakage. |
| **SECURITY Mapping** | SECURITY-08 (Application-Level Access Control) |
| **Verification** | Create two test users A and B. User A creates a project. User B attempts GET /api/projects/[A's project ID] -- must return 404. User B attempts PATCH and DELETE on A's project ID -- both must return 404. Verify via manual API calls with session cookies swapped. |

### NFR-02-004: Transactional Cascade Delete

| Field | Value |
|-------|-------|
| **Category** | Security |
| **Requirement** | Project deletion must cascade-delete all associated tasks within a single database transaction |
| **Metric/Target** | Prisma `$transaction` wraps: (1) delete all tasks where `projectId = ?`, (2) delete project. If either step fails, entire operation rolls back. No orphaned tasks in DB after project deletion. No orphaned projects if task deletion fails. |
| **SECURITY Mapping** | SECURITY-15 (Exception Handling and Fail-Safe Defaults) |
| **Verification** | Create a project with 5 tasks. Delete the project. Query DB for tasks with that projectId -- must return zero rows. Simulate a failure mid-transaction (e.g., inject error after task deletion but before project deletion in test) -- verify project still exists and tasks are not deleted. |

### NFR-02-005: Project Name Input Validation

| Field | Value |
|-------|-------|
| **Category** | Security |
| **Requirement** | Project name input must be validated via Zod schema on both client and server |
| **Metric/Target** | Shared Zod schema in `lib/validations/project-schemas.ts`. Validates: min 1 char, max 50 chars, trimmed. SQL injection payloads, XSS strings, and oversized inputs all rejected with 400. No raw user input reaches Prisma queries without validation. |
| **SECURITY Mapping** | SECURITY-05 (Input Validation) |
| **Verification** | Send POST /api/projects with: empty name, 51-char name, SQL injection string (`'; DROP TABLE projects; --`), XSS payload (`<script>alert(1)</script>`), 10K character string. All must return 400 with Zod validation error. No 500 responses. Verify same schema is imported in both CreateProjectModal and API route. |

---

## Reliability

### NFR-02-006: Zero-Project Invariant

| Field | Value |
|-------|-------|
| **Category** | Reliability |
| **Requirement** | System must ensure at least one project exists for every authenticated user at all times |
| **Metric/Target** | Two enforcement points: (1) On first login / dashboard mount, if GET /api/projects returns empty array, client auto-creates "My Project" via POST. (2) When deleting last project, client creates new default project first, then deletes the original. User never sees an empty project list. |
| **SECURITY Mapping** | SECURITY-15 (Fail-Safe Defaults) |
| **Verification** | Test scenario 1: Register new user, navigate to dashboard. Verify projectStore.projects.length >= 1 and ProjectSwitcher shows "My Project". Test scenario 2: Create one project, delete it. Verify a new "My Project" exists and is set as active. Board is accessible (no error state from missing project context). |

---

## SECURITY Compliance Matrix (UOW-02 Additions)

UOW-01 baseline covers SECURITY-01 through SECURITY-15. UOW-02 adds unit-specific enforcement for the following rules only:

| SECURITY Rule | Rule Name | UOW-02 Addition | NFR ID |
|---------------|-----------|-----------------|--------|
| SECURITY-05 | Input Validation | Zod schema for project name (create + rename) | NFR-02-005 |
| SECURITY-08 | Application-Level Access Control | Ownership check on all project CRUD operations | NFR-02-003 |
| SECURITY-15 | Exception Handling and Fail-Safe Defaults | Transactional cascade delete; zero-project invariant | NFR-02-004, NFR-02-006 |

All other SECURITY rules (01-04, 06-07, 09-14) are fully covered by UOW-01 baseline NFRs and require no additional UOW-02-specific implementation.

---

## NFR Summary Matrix

| NFR ID | Category | Short Description | Target | SECURITY Rule |
|--------|----------|------------------|--------|---------------|
| NFR-02-001 | Performance | Project list API response | P95 < 200ms | -- |
| NFR-02-002 | Performance | Project switch UI response | < 500ms (UI + refetch) | -- |
| NFR-02-003 | Security | Ownership enforcement | 404 on cross-user access | SECURITY-08 |
| NFR-02-004 | Security | Cascade delete transactional | Prisma $transaction, no orphans | SECURITY-15 |
| NFR-02-005 | Security | Project name validation | Zod, shared client/server | SECURITY-05 |
| NFR-02-006 | Reliability | Zero-project invariant | Always >= 1 project per user | SECURITY-15 |
