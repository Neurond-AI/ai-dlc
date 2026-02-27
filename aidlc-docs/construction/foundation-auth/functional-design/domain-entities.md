# Domain Entities -- UOW-01: Foundation & Auth

## Overview

This document defines the domain entities for UOW-01. All auth-related entities (User, Session, Account, Verification) follow the **better-auth** schema conventions and are managed through the Prisma adapter. Additional application entities (Project, Task, PipelineRun) are defined as stubs in UOW-01 and fleshed out in later units.

---

## Entity Definitions

### User

The core identity entity. Managed by better-auth with application-specific relations.

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
  projects      Project[]    // UOW-02+

  @@map("user")
}
```

| Field | Type | Constraints | Description |
|-------|------|------------|-------------|
| id | String | PK, cuid() | Unique identifier |
| email | String | unique, case-insensitive index | User email address. Stored lowercase. |
| emailVerified | Boolean | default: false | Reserved for future email verification flow |
| name | String | required, 1-100 chars | Display name shown in UI |
| image | String? | optional | Avatar URL, reserved for future use |
| createdAt | DateTime | auto | Record creation timestamp |
| updatedAt | DateTime | auto | Last modification timestamp |

**Indexes**:
- `@@unique([email])` -- enforced at DB level
- Email stored and queried in lowercase for case-insensitive matching

---

### Session

Managed entirely by better-auth. Tracks active user sessions stored in PostgreSQL.

```prisma
model Session {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("session")
}
```

| Field | Type | Constraints | Description |
|-------|------|------------|-------------|
| id | String | PK, cuid() | Session identifier |
| userId | String | FK -> User.id | Owner of this session |
| token | String | unique | Hashed session token (stored in httpOnly cookie on client) |
| expiresAt | DateTime | required | Session expiry timestamp. Sliding: extended on activity. |
| ipAddress | String? | optional | Client IP at session creation (audit) |
| userAgent | String? | optional | Client user-agent at session creation (audit) |
| createdAt | DateTime | auto | Session creation timestamp |
| updatedAt | DateTime | auto | Last refresh timestamp |

**Lifecycle**:
- Created on login/register
- Refreshed (updatedAt + expiresAt) every 24 hours of activity
- Deleted on logout or expiry
- Cascade deleted when parent User is deleted

---

### Account

Managed by better-auth. Links authentication providers to users. For email/password auth, `providerId` is "credential".

```prisma
model Account {
  id                String   @id @default(cuid())
  userId            String
  accountId         String
  providerId        String
  accessToken       String?
  refreshToken      String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope             String?
  password          String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  // Relations
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("account")
}
```

| Field | Type | Constraints | Description |
|-------|------|------------|-------------|
| id | String | PK, cuid() | Account record identifier |
| userId | String | FK -> User.id | Owner of this account |
| accountId | String | required | Provider-specific account ID (for credential: same as user ID) |
| providerId | String | required | Auth provider identifier: "credential" for email/password |
| accessToken | String? | optional | OAuth access token (not used for credential auth) |
| refreshToken | String? | optional | OAuth refresh token (not used for credential auth) |
| accessTokenExpiresAt | DateTime? | optional | OAuth token expiry |
| refreshTokenExpiresAt | DateTime? | optional | OAuth refresh token expiry |
| scope | String? | optional | OAuth scope |
| password | String? | optional | Hashed password (bcrypt). Only set for providerId="credential". |
| createdAt | DateTime | auto | Record creation timestamp |
| updatedAt | DateTime | auto | Last modification timestamp |

**Notes**:
- For email/password auth: `providerId = "credential"`, `password` contains bcrypt hash
- OAuth fields (accessToken, refreshToken, scope) are null for credential provider
- Cascade deleted when parent User is deleted

---

### Verification

Managed by better-auth. Stores verification tokens for email verification, password reset, etc. Included for future use; not actively used in UOW-01 MVP.

```prisma
model Verification {
  id         String   @id @default(cuid())
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@map("verification")
}
```

| Field | Type | Constraints | Description |
|-------|------|------------|-------------|
| id | String | PK, cuid() | Verification record identifier |
| identifier | String | required | What is being verified (e.g., email address) |
| value | String | required | Verification token or code |
| expiresAt | DateTime | required | Token expiry timestamp |
| createdAt | DateTime | auto | Record creation timestamp |
| updatedAt | DateTime | auto | Last modification timestamp |

**Notes**:
- Used by better-auth for email verification and password reset flows
- Not actively consumed in UOW-01 (emailVerified defaults to false)
- Records auto-expire; cleanup handled by better-auth or periodic DB job

---

### Project (Stub -- expanded in UOW-02)

Defined in the Prisma schema during UOW-01 to establish the full data model. CRUD logic implemented in UOW-02.

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

  @@map("project")
}
```

---

### Task (Stub -- expanded in UOW-03)

Defined in the Prisma schema during UOW-01. Full implementation in UOW-03.

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

### PipelineRun (Stub -- expanded in UOW-04)

Defined in the Prisma schema during UOW-01. Full implementation in UOW-04.

```prisma
model PipelineRun {
  id             String    @id @default(cuid())
  taskId         String
  phase          String    @default("planning")
  iteration      Int       @default(1)
  status         String    @default("running")
  agentLogs      Json?
  fileChanges    Json?
  reviewFindings Json?
  startedAt      DateTime  @default(now())
  completedAt    DateTime?

  // Relations
  task           Task      @relation(fields: [taskId], references: [id], onDelete: Cascade)

  @@map("pipeline_run")
}
```

---

## Entity Relationship Diagram

```
+----------------+       1:N       +----------------+
|     User       |<--------------->|    Session      |
|----------------|                 |----------------|
| id (PK)        |                 | id (PK)        |
| email (unique) |                 | userId (FK)    |
| name           |                 | token (unique) |
| emailVerified  |                 | expiresAt      |
| image?         |                 | ipAddress?     |
| createdAt      |                 | userAgent?     |
| updatedAt      |                 | createdAt      |
+----------------+                 | updatedAt      |
       |                           +----------------+
       |
       | 1:N
       v
+----------------+
|    Account     |
|----------------|
| id (PK)        |
| userId (FK)    |
| accountId      |
| providerId     |
| password?      |
| accessToken?   |
| createdAt      |
| updatedAt      |
+----------------+
       ^
       | (User)
       |
+----------------+       1:N       +----------------+
|     User       |<--------------->|    Project      |
|                |                 |----------------|
|                |                 | id (PK)        |
|                |                 | name           |
|                |                 | userId (FK)    |
|                |                 | createdAt      |
|                |                 | updatedAt      |
+----------------+                 +----------------+
                                          |
                                          | 1:N
                                          v
                                   +----------------+       1:N       +----------------+
                                   |     Task       |<--------------->|  PipelineRun   |
                                   |----------------|                 |----------------|
                                   | id (PK)        |                 | id (PK)        |
                                   | title          |                 | taskId (FK)    |
                                   | description?   |                 | phase          |
                                   | category       |                 | iteration      |
                                   | priority       |                 | status         |
                                   | status         |                 | agentLogs?     |
                                   | pipelineState? |                 | fileChanges?   |
                                   | subtasks?      |                 | reviewFindings?|
                                   | projectId (FK) |                 | startedAt      |
                                   | createdAt      |                 | completedAt?   |
                                   | updatedAt      |                 +----------------+
                                   +----------------+


+------------------+
|  Verification    |  (standalone, managed by better-auth)
|------------------|
| id (PK)          |
| identifier       |
| value            |
| expiresAt        |
| createdAt        |
| updatedAt        |
+------------------+
```

## Relationship Summary

| From | To | Type | FK Location | Cascade Delete |
|------|----|------|-------------|---------------|
| User | Session | 1:N | Session.userId | Yes |
| User | Account | 1:N | Account.userId | Yes |
| User | Project | 1:N | Project.userId | Yes |
| Project | Task | 1:N | Task.projectId | Yes |
| Task | PipelineRun | 1:N | PipelineRun.taskId | Yes |

**Cascade Policy**: Deleting a User cascades through all related records (sessions, accounts, projects, tasks, pipeline runs). This ensures no orphan records.

---

## Enum Value Definitions

### Task Category (used in UOW-03, defined here for schema completeness)

| Value | Display Label |
|-------|-------------|
| feature | Feature |
| bug-fix | Bug Fix |
| refactoring | Refactoring |
| performance | Performance |
| security | Security |
| ui-ux | UI/UX |

### Task Priority (used in UOW-03, defined here for schema completeness)

| Value | Display Label |
|-------|-------------|
| low | Low |
| medium | Medium |
| high | High |
| critical | Critical |

### Task Status / Kanban Column (used in UOW-03, defined here for schema completeness)

| Value | Display Label | Column Position |
|-------|-------------|----------------|
| backlog | Backlog | 1 |
| spec | Spec | 2 |
| building | Building | 3 |
| review | Review | 4 |
| done | Done | 5 |

### Pipeline Phase (used in UOW-04, defined here for schema completeness)

| Value | Display Label |
|-------|-------------|
| planning | Planning |
| coding | Coding |
| reviewing | Reviewing |
| fixing | Fixing |
| completed | Completed |
| failed | Failed |

### Pipeline Run Status (used in UOW-04, defined here for schema completeness)

| Value | Description |
|-------|------------|
| running | Pipeline actively executing |
| passed | Review passed, awaiting human approval |
| failed | Max retries exhausted or unrecoverable error |
| cancelled | User-initiated cancellation |

---

## TypeScript Type Definitions (UOW-01 Scope)

### types/auth.ts

```ts
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

export interface AuthSession {
  user: AuthUser;
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
  };
}
```

### types/project.ts (Stub)

```ts
export interface Project {
  id: string;
  name: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### types/task.ts (Stub)

```ts
export type TaskCategory = "feature" | "bug-fix" | "refactoring" | "performance" | "security" | "ui-ux";
export type TaskPriority = "low" | "medium" | "high" | "critical";
export type TaskStatus = "backlog" | "spec" | "building" | "review" | "done";

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  category: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;
  pipelineState?: Record<string, unknown> | null;
  subtasks?: Record<string, unknown>[] | null;
  projectId: string;
  createdAt: Date;
  updatedAt: Date;
}
```
