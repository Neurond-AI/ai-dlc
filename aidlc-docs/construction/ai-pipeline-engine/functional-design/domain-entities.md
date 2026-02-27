# Domain Entities -- UOW-04: AI Pipeline Engine

## Overview

This document defines the domain entities for UOW-04. The primary entity is **PipelineRun** (expanded from the UOW-01 stub). This document also defines the structured JSON schemas stored within PipelineRun fields, and all associated TypeScript types used across the pipeline engine.

---

## Entity Definitions

### PipelineRun (Expanded)

The core entity tracking a single pipeline execution for a task. Stores agent outputs, review results, and error state as structured JSON columns.

```prisma
model PipelineRun {
  id             String    @id @default(cuid())
  taskId         String
  phase          String    @default("planning")   // PipelinePhase enum value
  iteration      Int       @default(0)
  status         String    @default("running")    // PipelineStatus enum value
  agentLogs      Json?     @default("{\"planner\":[],\"coder\":[],\"reviewer\":[]}")
  fileChanges    Json?     @default("{\"files\":[]}")
  reviewFindings Json?
  errorDetails   Json?
  startedAt      DateTime  @default(now())
  completedAt    DateTime?

  // Relations
  task           Task      @relation(fields: [taskId], references: [id], onDelete: Cascade)

  @@index([taskId, startedAt(sort: Desc)])
  @@map("pipeline_run")
}
```

| Field | Type | Constraints | Description |
|-------|------|------------|-------------|
| id | String | PK, cuid() | Unique run identifier |
| taskId | String | FK -> Task.id, indexed | The task this pipeline run belongs to |
| phase | String | default: "planning" | Current pipeline phase (PipelinePhase enum) |
| iteration | Int | default: 0 | Current review iteration (0 = initial, 1 = first fix, 2 = second fix). Max 2 (BR-04-003). |
| status | String | default: "running" | Overall run status (PipelineStatus enum) |
| agentLogs | Json? | default: empty structure | Accumulated log entries per agent (AgentLogs schema) |
| fileChanges | Json? | default: empty files array | Accumulated file changes from Coder (FileChanges schema) |
| reviewFindings | Json? | nullable | Latest review result from Reviewer (ReviewResult schema) |
| errorDetails | Json? | nullable | Error context when pipeline is paused/failed (ErrorDetails schema) |
| startedAt | DateTime | auto | Pipeline start timestamp |
| completedAt | DateTime? | nullable | Pipeline completion/failure/cancellation timestamp |

**Indexes**:
- `@@index([taskId, startedAt(sort: Desc)])` -- efficient "latest run for task" query

**Lifecycle**:
- Created on pipeline start (POST /api/tasks/[id]/start-pipeline)
- Updated at every phase transition (phase, iteration, status, agent outputs)
- completedAt set when pipeline reaches terminal state (COMPLETED, FAILED, CANCELLED)
- Cascade deleted when parent Task is deleted

---

## JSON Schema Definitions

### SubtaskList

Stored on `Task.subtasks` (JSON column). Produced by PlannerAgent.

```json
{
  "subtasks": [
    {
      "id": "subtask-1",
      "title": "Set up database schema",
      "description": "Create Prisma models for User and Post entities...",
      "order": 1
    },
    {
      "id": "subtask-2",
      "title": "Implement API routes",
      "description": "Create GET/POST endpoints for...",
      "order": 2
    }
  ]
}
```

**Zod Schema**:
```ts
const subtaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  order: z.number().int().min(1),
});

const subtaskListSchema = z.object({
  subtasks: z.array(subtaskSchema).min(1).max(10),
});
```

**Validation Rule**: BR-04-005

---

### FileChanges

Stored on `PipelineRun.fileChanges` (JSON column). Produced by CoderAgent.

```json
{
  "files": [
    {
      "filePath": "src/lib/db/schema.ts",
      "language": "typescript",
      "content": "import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';\n...",
      "action": "create"
    },
    {
      "filePath": "src/app/api/users/route.ts",
      "language": "typescript",
      "content": "import { NextResponse } from 'next/server';\n...",
      "action": "create"
    },
    {
      "filePath": "src/lib/old-util.ts",
      "language": "typescript",
      "content": "",
      "action": "delete"
    }
  ]
}
```

**Zod Schema**:
```ts
const fileChangeSchema = z.object({
  filePath: z.string().min(1),
  language: z.string().min(1),
  content: z.string(),
  action: z.enum(["create", "modify", "delete"]),
});

const fileChangesSchema = z.object({
  files: z.array(fileChangeSchema),
});
```

**Validation Rule**: BR-04-006

**Notes**:
- `content` can be empty for "delete" actions
- `language` is used for syntax highlighting in the diff viewer (UOW-06)
- File changes accumulate across subtasks (Coder is called per subtask)

---

### ReviewResult

Stored on `PipelineRun.reviewFindings` (JSON column). Produced by ReviewerAgent.

```json
{
  "passed": false,
  "score": 62,
  "findings": [
    {
      "severity": "error",
      "file": "src/app/api/users/route.ts",
      "line": 15,
      "message": "Missing input validation on POST handler. User-supplied data should be validated with Zod schema."
    },
    {
      "severity": "warning",
      "file": "src/lib/db/schema.ts",
      "line": 8,
      "message": "Consider adding an index on the email column for faster lookups."
    },
    {
      "severity": "info",
      "file": "src/app/api/users/route.ts",
      "line": 3,
      "message": "Unused import: 'headers' from 'next/headers'."
    }
  ]
}
```

**Zod Schema**:
```ts
const findingSeverity = z.enum(["error", "warning", "info"]);

const findingSchema = z.object({
  severity: findingSeverity,
  file: z.string().min(1),
  line: z.number().int().min(0),
  message: z.string().min(1),
});

const reviewResultSchema = z.object({
  passed: z.boolean(),
  score: z.number().min(0).max(100),
  findings: z.array(findingSchema),
});
```

**Validation Rule**: BR-04-007

**Notes**:
- `passed` is the definitive verdict; `score` is informational
- Pass threshold: score >= 70 AND passed === true
- `line: 0` indicates a file-level finding (not line-specific)

---

### AgentLogs

Stored on `PipelineRun.agentLogs` (JSON column). Accumulated during pipeline execution.

```json
{
  "planner": [
    "Analyzing task requirements...",
    "Breaking down into 4 subtasks...",
    "{ \"subtasks\": [..."
  ],
  "coder": [
    "Working on subtask 1: Set up database schema...",
    "Creating file src/lib/db/schema.ts...",
    "..."
  ],
  "reviewer": [
    "Reviewing 3 file changes...",
    "Checking correctness...",
    "Found 2 issues..."
  ]
}
```

**Zod Schema**:
```ts
const agentLogsSchema = z.object({
  planner: z.array(z.string()),
  coder: z.array(z.string()),
  reviewer: z.array(z.string()),
});
```

**Notes**:
- Log entries are accumulated string chunks from streaming
- Stored periodically during execution (batched, not per-token) to avoid excessive DB writes
- DB updated at phase boundaries and on completion; real-time logs go through SSE only

---

### ErrorDetails

Stored on `PipelineRun.errorDetails` (JSON column). Set when pipeline enters PAUSED or FAILED state.

```json
{
  "type": "api_error",
  "message": "Anthropic API rate limited (429)",
  "statusCode": 429,
  "failedAgent": "coder",
  "failedPhase": "coding",
  "retryCount": 1,
  "maxRetries": 3,
  "timestamp": 1709001234567
}
```

**Zod Schema**:
```ts
const errorDetailsSchema = z.object({
  type: z.enum(["api_error", "parse_error", "timeout", "unknown"]),
  message: z.string(),
  statusCode: z.number().optional(),
  failedAgent: z.enum(["planner", "coder", "reviewer"]).optional(),
  failedPhase: z.enum(["planning", "coding", "reviewing", "fixing"]).optional(),
  retryCount: z.number().int().min(0).default(0),
  maxRetries: z.number().int().default(3),
  timestamp: z.number(),
});
```

---

## Enum Value Definitions (UOW-04 Scope)

### PipelinePhase

| Value | Display Label | Description |
|-------|-------------|-------------|
| planning | Planning | PlannerAgent generating subtasks |
| coding | Coding | CoderAgent generating file changes |
| reviewing | Reviewing | ReviewerAgent evaluating output |
| fixing | Fixing | CoderAgent addressing review findings |
| completed | Completed | Pipeline finished successfully |
| failed | Failed | Max retries exhausted or unrecoverable error |
| cancelled | Cancelled | User-initiated cancellation |
| paused | Paused | Awaiting user action after error |

### PipelineStatus

| Value | Description |
|-------|------------|
| running | Pipeline actively executing an agent |
| passed | Review passed, awaiting human approval |
| failed | Max retries exhausted or unrecoverable error |
| cancelled | User-initiated cancellation |
| paused | Pipeline halted, awaiting user retry/cancel decision |

### AgentType

| Value | Description |
|-------|------------|
| planner | PlannerAgent (subtask generation) |
| coder | CoderAgent (file change generation) |
| reviewer | ReviewerAgent (code review) |

### FindingSeverity

| Value | Display | Color |
|-------|---------|-------|
| error | Error | Red |
| warning | Warning | Yellow/Amber |
| info | Info | Blue |

### FileAction

| Value | Description |
|-------|------------|
| create | New file (did not exist before) |
| modify | Existing file with changes |
| delete | File to be removed |

---

## TypeScript Type Definitions

### types/pipeline.ts

```ts
// -- Pipeline Phase & Status --

export type PipelinePhase =
  | "planning"
  | "coding"
  | "reviewing"
  | "fixing"
  | "completed"
  | "failed"
  | "cancelled"
  | "paused";

export type PipelineStatus =
  | "running"
  | "passed"
  | "failed"
  | "cancelled"
  | "paused";

// -- PipelineRun (DB record shape) --

export interface PipelineRun {
  id: string;
  taskId: string;
  phase: PipelinePhase;
  iteration: number;
  status: PipelineStatus;
  agentLogs: AgentLogs | null;
  fileChanges: FileChanges | null;
  reviewFindings: ReviewResult | null;
  errorDetails: ErrorDetails | null;
  startedAt: Date;
  completedAt: Date | null;
}

// -- Client-side pipeline state (Zustand) --

export interface PipelineRunState {
  runId: string;
  phase: PipelinePhase;
  status: PipelineStatus;
  iteration: number;
  startedAt: number;
  completedAt: number | null;
  errorDetails: ErrorDetails | null;
  fileChanges: FileChanges | null;
  reviewFindings: ReviewResult | null;
}
```

### types/agent.ts

```ts
// -- Subtask (Planner output) --

export interface Subtask {
  id: string;
  title: string;
  description: string;
  order: number;
}

export interface SubtaskList {
  subtasks: Subtask[];
}

// -- File Change (Coder output) --

export type FileAction = "create" | "modify" | "delete";

export interface FileChange {
  filePath: string;
  language: string;
  content: string;
  action: FileAction;
}

export interface FileChanges {
  files: FileChange[];
}

// -- Review Result (Reviewer output) --

export type FindingSeverity = "error" | "warning" | "info";

export interface ReviewFinding {
  severity: FindingSeverity;
  file: string;
  line: number;
  message: string;
}

export interface ReviewResult {
  passed: boolean;
  score: number;
  findings: ReviewFinding[];
}

// -- Agent Logs --

export type AgentType = "planner" | "coder" | "reviewer";

export interface AgentLogs {
  planner: string[];
  coder: string[];
  reviewer: string[];
}

// -- Error Details --

export type ErrorType = "api_error" | "parse_error" | "timeout" | "unknown";

export interface ErrorDetails {
  type: ErrorType;
  message: string;
  statusCode?: number;
  failedAgent?: AgentType;
  failedPhase?: PipelinePhase;
  retryCount: number;
  maxRetries: number;
  timestamp: number;
}

// -- Agent Execution Config --

export interface AgentConfig {
  model: string;
  maxTokens: number;
}

export const AGENT_CONFIGS: Record<AgentType, AgentConfig> = {
  planner: { model: "claude-sonnet-4-20250514", maxTokens: 4096 },
  coder: { model: "claude-sonnet-4-20250514", maxTokens: 8192 },
  reviewer: { model: "claude-sonnet-4-20250514", maxTokens: 4096 },
};
```

### types/sse.ts

```ts
import type { AgentType, FileChanges, ReviewResult } from "./agent";
import type { PipelinePhase, PipelineStatus } from "./pipeline";
import type { TaskStatus } from "./task";

// -- SSE Event Types --

export type SSEEventType =
  | "agent-log"
  | "phase-change"
  | "task-status"
  | "error"
  | "pipeline-complete"
  | "timeout";

// -- SSE Event Data Shapes --

export interface AgentLogEvent {
  agent: AgentType;
  chunk: string;
  timestamp: number;
}

export interface PhaseChangeEvent {
  phase: PipelinePhase;
  status: PipelineStatus;
  iteration: number;
  timestamp: number;
}

export interface TaskStatusEvent {
  taskId: string;
  newStatus: TaskStatus;
  timestamp: number;
}

export interface ErrorEvent {
  type: string;
  message: string;
  retryable: boolean;
  retryCount: number;
  maxRetries: number;
  timestamp: number;
}

export interface PipelineCompleteEvent {
  taskId: string;
  result: "passed" | "failed";
  fileChanges?: FileChanges;
  reviewFindings?: ReviewResult;
  timestamp: number;
}

export interface TimeoutEvent {
  message: string;
}

// -- Discriminated Union for SSE Dispatch --

export type SSEEvent =
  | { type: "agent-log"; data: AgentLogEvent }
  | { type: "phase-change"; data: PhaseChangeEvent }
  | { type: "task-status"; data: TaskStatusEvent }
  | { type: "error"; data: ErrorEvent }
  | { type: "pipeline-complete"; data: PipelineCompleteEvent }
  | { type: "timeout"; data: TimeoutEvent };

// -- Client-side Log Entry (for Zustand store) --

export interface LogEntry {
  chunk: string;
  timestamp: number;
}

export interface AgentLogsState {
  planner: LogEntry[];
  coder: LogEntry[];
  reviewer: LogEntry[];
}
```

---

## Entity Relationship Context (UOW-04 Scope)

```
+----------------+       1:N       +------------------+
|     Task       |<--------------->|   PipelineRun    |
|----------------|                 |------------------|
| id (PK)        |                 | id (PK)          |
| title          |                 | taskId (FK)      |
| description?   |                 | phase            |
| category       |                 | iteration        |
| priority       |                 | status           |
| status         |                 | agentLogs (Json) |
| subtasks (Json) <-- Planner out  | fileChanges (Json)|
| pipelineState? |                 | reviewFindings   |
| projectId (FK) |                 | errorDetails?    |
| createdAt      |                 | startedAt        |
| updatedAt      |                 | completedAt?     |
+----------------+                 +------------------+
                                          |
                                          | contains (JSON)
                                          v
                           +---------------------------+
                           | SubtaskList (on Task)     |
                           | FileChanges               |
                           | ReviewResult              |
                           | AgentLogs                 |
                           | ErrorDetails              |
                           +---------------------------+
```

**Key Relationships**:
- Task 1:N PipelineRun (a task can have multiple runs over its lifetime, but only one active at a time per BR-04-002)
- PipelineRun stores Coder output (fileChanges), Reviewer output (reviewFindings), and logs (agentLogs) as JSON
- Planner output (subtasks) is stored on the Task record itself, as it represents the task's decomposition

---

## Validation Schemas File

**File**: `src/lib/validations/pipeline-schemas.ts`

Contains all Zod schemas referenced above:
- `subtaskSchema`, `subtaskListSchema`
- `fileChangeSchema`, `fileChangesSchema`
- `findingSchema`, `reviewResultSchema`
- `agentLogsSchema`
- `errorDetailsSchema`
- `startPipelineRequestSchema` (validates start-pipeline API input)
- `retryPipelineRequestSchema` (validates retry API input)
- `requestChangesSchema` (validates request-changes API input: `{ feedback: string }`)
