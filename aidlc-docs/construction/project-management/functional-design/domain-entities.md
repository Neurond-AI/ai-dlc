# Domain Entities -- UOW-02: Project Management

## Overview

This document expands the Project entity stub defined in UOW-01 into a fully specified domain entity for UOW-02. The Project entity is the core of this unit -- all other entities (User, Task, etc.) retain their UOW-01 definitions. This document also defines the full TypeScript types, Zod validation schemas, and API request/response shapes used by UOW-02.

---

## Entity Definition

### Project (Expanded from UOW-01 Stub)

The central entity for UOW-02. Represents a named workspace owned by a single user, containing zero or more tasks.

```prisma
model Project {
  id        String   @id @default(cuid())
  name      String
  userId    String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tasks     Task[]

  // Indexes
  @@unique([userId, name])   // Enforces name uniqueness per user at DB level
  @@index([userId])          // Fast lookup for user's projects
  @@map("project")
}
```

| Field | Type | Constraints | Description |
|-------|------|------------|-------------|
| id | String | PK, cuid() | Unique identifier |
| name | String | required, 1-50 chars | User-defined project name. Trimmed on save. |
| userId | String | FK -> User.id | Owner of this project. Set to authenticated user on creation. |
| createdAt | DateTime | auto | Record creation timestamp |
| updatedAt | DateTime | auto | Last modification timestamp (updated on rename) |

**Indexes**:
- `@@unique([userId, name])` -- composite unique constraint. Prevents duplicate project names per user at the database level. Note: Prisma's `@@unique` is case-sensitive by default. For case-insensitive enforcement, a PostgreSQL expression index is added via migration:
  ```sql
  CREATE UNIQUE INDEX "project_userId_name_ci" ON "project" ("userId", LOWER("name"));
  ```
- `@@index([userId])` -- optimizes `WHERE userId = ?` queries for listing user's projects

**Relations**:
- `user` (User, many-to-one): The owning user. Cascade delete: if User is deleted, all their projects are deleted.
- `tasks` (Task[], one-to-many): Tasks belonging to this project. Cascade delete: if Project is deleted, all its tasks are deleted (and their PipelineRuns via Task cascade).

**Lifecycle**:
- Created via POST /api/projects (user-initiated or default project auto-creation)
- Renamed via PATCH /api/projects/[id] (updates name and updatedAt)
- Deleted via DELETE /api/projects/[id] (cascades to tasks and pipeline runs)
- Listed via GET /api/projects (filtered by userId from session)

---

## Related Entities (Unchanged from UOW-01)

### User (Reference)

The Project entity relates to User via `userId`. No schema changes in UOW-02.

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  emailVerified Boolean   @default(false)
  name          String
  image         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relations
  sessions      Session[]
  accounts      Account[]
  projects      Project[]

  @@map("user")
}
```

### Task (Reference -- Expanded in UOW-03)

Tasks belong to a Project. Cascade delete from Project to Task is defined in UOW-01 schema. No schema changes in UOW-02.

```prisma
model Task {
  id            String   @id @default(cuid())
  title         String
  description   String?
  category      String   @default("feature")
  priority      String   @default("medium")
  status        String   @default("backlog")
  pipelineState Json?
  subtasks      Json?
  projectId     String
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  // Relations
  project       Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  pipelineRuns  PipelineRun[]

  @@map("task")
}
```

---

## Entity Relationship (UOW-02 Focus)

```
+----------------+       1:N       +----------------+       1:N       +----------------+
|     User       |<--------------->|    Project      |<--------------->|     Task       |
|----------------|                 |----------------|                 |----------------|
| id (PK)        |                 | id (PK)        |                 | id (PK)        |
| email (unique) |                 | name           |                 | title          |
| name           |                 | userId (FK)    |                 | projectId (FK) |
| ...            |                 | createdAt      |                 | ...            |
+----------------+                 | updatedAt      |                 +----------------+
                                   +----------------+
                                   Indexes:
                                   - @@unique([userId, name])
                                   - @@index([userId])
                                   - Expression: LOWER(name) unique per userId
```

**Cascade Chain**: User -> Project -> Task -> PipelineRun
Deleting a project removes all its tasks and their pipeline runs.

---

## TypeScript Type Definitions

### types/project.ts (Full -- Replaces UOW-01 Stub)

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

---

## Zod Validation Schemas

### validations/project-schemas.ts

```ts
import { z } from "zod";

/**
 * Schema for creating a new project.
 * Used in both client-side form validation and server-side API validation.
 */
export const createProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Project name is required")
    .max(50, "Project name must be 50 characters or fewer"),
});

/**
 * Schema for renaming a project.
 * Identical constraints to create; reuses the same name rules.
 */
export const renameProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Project name is required")
    .max(50, "Project name must be 50 characters or fewer"),
});

/**
 * Schema for project ID path parameter.
 */
export const projectIdSchema = z.object({
  id: z.string().min(1, "Project ID is required"),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type RenameProjectInput = z.infer<typeof renameProjectSchema>;
```

---

## API Request/Response Shapes

### POST /api/projects

**Request**:
```ts
// Body
{ name: string }  // Validated by createProjectSchema
```

**Response 201**:
```ts
{
  id: string;
  name: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}
```

### PATCH /api/projects/[id]

**Request**:
```ts
// Path: id (project ID)
// Body
{ name: string }  // Validated by renameProjectSchema
```

**Response 200**:
```ts
{
  id: string;
  name: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}
```

### GET /api/projects

**Response 200**:
```ts
{
  projects: Array<{
    id: string;
    name: string;
    userId: string;
    createdAt: string;
    updatedAt: string;
  }>
}
```

### DELETE /api/projects/[id]

**Response 204**: No body

---

## Business Rule Mapping

| Entity Field | Business Rules |
|-------------|---------------|
| Project.name | BR-02-001 (required, 1-50 chars), BR-02-002 (unique per user) |
| Project.userId | BR-02-003 (ownership enforcement on all operations) |
| Project (count) | BR-02-008 (max 20 per user) |
| Project (existence) | BR-02-005 (min 1 project invariant), BR-02-006 (default name) |
