# Code Generation Plan -- UOW-04: AI Pipeline Engine

## Overview

This plan defines the step-by-step implementation sequence for UOW-04 (AI Pipeline Engine), the server-side AI orchestration backbone of the AutoCoder project. UOW-04 delivers the PipelineOrchestrator state machine, three AI agent wrappers (Planner, Coder, Reviewer), SSE real-time streaming, pipeline API routes, and client-side integration (Zustand store, hooks, minimal UI controls).

**Unit**: UOW-04
**Stories**: US-025 through US-032
**Dependencies**: UOW-01 (auth, Prisma schema, session middleware), UOW-02 (project ownership), UOW-03 (TaskService, taskStore, task status transitions)
**New Dependency**: `@anthropic-ai/sdk` (pinned at install)
**Complexity**: High

---

## Story Reference

| Story | Title | Priority |
|-------|-------|----------|
| US-025 | Start Pipeline Manually | Must |
| US-026 | Planner Agent Generates Subtasks | Must |
| US-027 | Coder Agent Generates File Changes | Must |
| US-028 | Reviewer Agent Validates Output | Must |
| US-029 | Auto-Fix on Review Failure | Must |
| US-030 | Pipeline Completes Successfully | Must |
| US-031 | Pipeline Fails After Max Retries | Must |
| US-032 | Cancel Running Pipeline | Should |

---

## File Structure (Target)

```
src/
├── app/
│   └── api/
│       ├── tasks/
│       │   └── [id]/
│       │       └── start-pipeline/
│       │           └── route.ts              # POST start pipeline
│       ├── pipeline/
│       │   └── [taskId]/
│       │       ├── status/
│       │       │   └── route.ts              # GET pipeline status
│       │       ├── retry/
│       │       │   └── route.ts              # POST retry paused pipeline
│       │       ├── cancel/
│       │       │   └── route.ts              # POST cancel active pipeline
│       │       ├── approve/
│       │       │   └── route.ts              # POST approve completed pipeline
│       │       └── request-changes/
│       │           └── route.ts              # POST request changes with feedback
│       └── sse/
│           └── [taskId]/
│               └── route.ts                  # GET SSE stream
├── lib/
│   ├── agents/
│   │   ├── agent-base.ts                     # Shared agent utilities
│   │   ├── planner-agent.ts                  # PlannerAgent service
│   │   ├── coder-agent.ts                    # CoderAgent service
│   │   └── reviewer-agent.ts                 # ReviewerAgent service
│   ├── prompts/
│   │   ├── planner-prompt.ts                 # Planner system/user prompt builders
│   │   ├── coder-prompt.ts                   # Coder system/user prompt builders
│   │   └── reviewer-prompt.ts                # Reviewer system/user prompt builders
│   ├── services/
│   │   ├── pipeline-orchestrator.ts          # State machine & agent coordination
│   │   └── sse-service.ts                    # In-memory SSE connection registry
│   ├── validations/
│   │   └── pipeline-schemas.ts               # Zod schemas for pipeline domain
│   └── utils/
│       └── retry.ts                          # Exponential backoff utility
├── stores/
│   └── pipeline-store.ts                     # Zustand pipelineStore
├── hooks/
│   ├── use-sse.ts                            # SSE EventSource hook
│   └── use-pipeline.ts                       # Pipeline actions hook
├── components/
│   └── pipeline/
│       ├── pipeline-controls.tsx             # Start/Cancel/Retry/Approve buttons
│       └── error-notification.tsx            # Pipeline error banner + toast
└── types/
    ├── pipeline.ts                           # PipelinePhase, PipelineStatus, PipelineRun types
    ├── agent.ts                              # Subtask, FileChanges, ReviewResult, AgentConfig types
    └── sse.ts                                # SSE event type definitions
```

---

## Implementation Steps

### Step 1: Install Dependencies and Extend Prisma Schema

- [ ] **1.1** Install `@anthropic-ai/sdk` and pin to exact version in `package.json`

```bash
npm install @anthropic-ai/sdk --save-exact
```

- [ ] **1.2** Extend `prisma/schema.prisma` -- expand the `PipelineRun` model stub from UOW-01 into the full model with JSON fields, indexes, and cascade delete

**File**: `prisma/schema.prisma` (edit existing)

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

- [ ] **1.3** Ensure `Task` model has the `subtasks` JSON field and `pipelineRuns` relation

```prisma
// Add to Task model if not already present:
subtasks       Json?              // SubtaskList from PlannerAgent
pipelineState  Json?              // Current pipeline state summary
pipelineRuns   PipelineRun[]      // One-to-many relation
```

- [ ] **1.4** Run `npx prisma migrate dev --name add-pipeline-run-fields` to generate and apply the migration

- [ ] **1.5** Run `npx prisma generate` to update the Prisma client types

**Stories**: US-025 (PipelineRun record creation)
**Business Rules**: BR-04-002 (one active pipeline per task -- enforced via DB query at runtime)
**NFRs**: NFR-04-010 (state persistence at phase transitions)
**Dependencies**: UOW-01 Prisma schema must exist with User, Project, Task models

---

### Step 2: Type Definitions

- [ ] **2.1** Create `src/types/pipeline.ts` -- PipelinePhase, PipelineStatus, PipelineRun, PipelineRunState enums and interfaces

**File**: `src/types/pipeline.ts` (new)

Define:
- `PipelinePhase` union type: `"planning" | "coding" | "reviewing" | "fixing" | "completed" | "failed" | "cancelled" | "paused"`
- `PipelineStatus` union type: `"running" | "passed" | "failed" | "cancelled" | "paused"`
- `PipelineRun` interface (DB record shape with Date fields)
- `PipelineRunState` interface (client-side with number timestamps)

- [ ] **2.2** Create `src/types/agent.ts` -- Subtask, SubtaskList, FileChange, FileChanges, ReviewFinding, ReviewResult, AgentType, AgentLogs, ErrorDetails, AgentConfig, AGENT_CONFIGS

**File**: `src/types/agent.ts` (new)

Define:
- `Subtask` interface: `{ id, title, description, order }`
- `SubtaskList` interface: `{ subtasks: Subtask[] }`
- `FileAction` type: `"create" | "modify" | "delete"`
- `FileChange` interface: `{ filePath, language, content, action }`
- `FileChanges` interface: `{ files: FileChange[] }`
- `FindingSeverity` type: `"error" | "warning" | "info"`
- `ReviewFinding` interface: `{ severity, file, line, message }`
- `ReviewResult` interface: `{ passed, score, findings }`
- `AgentType` type: `"planner" | "coder" | "reviewer"`
- `AgentLogs` interface: `{ planner: string[], coder: string[], reviewer: string[] }`
- `ErrorType` type: `"api_error" | "parse_error" | "timeout" | "unknown"`
- `ErrorDetails` interface: `{ type, message, statusCode?, failedAgent?, failedPhase?, retryCount, maxRetries, timestamp }`
- `AgentConfig` interface: `{ model, maxTokens }`
- `AGENT_CONFIGS` constant: planner (4096), coder (8192), reviewer (4096) -- all `claude-sonnet-4-20250514`

- [ ] **2.3** Create `src/types/sse.ts` -- SSE event types, discriminated union, LogEntry, AgentLogsState

**File**: `src/types/sse.ts` (new)

Define:
- `SSEEventType` union: `"agent-log" | "phase-change" | "task-status" | "error" | "pipeline-complete" | "timeout"`
- `AgentLogEvent` interface: `{ agent, chunk, timestamp }`
- `PhaseChangeEvent` interface: `{ phase, status, iteration, timestamp }`
- `TaskStatusEvent` interface: `{ taskId, newStatus, timestamp }`
- `ErrorEvent` interface: `{ type, message, retryable, retryCount, maxRetries, timestamp }`
- `PipelineCompleteEvent` interface: `{ taskId, result, fileChanges?, reviewFindings?, timestamp }`
- `TimeoutEvent` interface: `{ message }`
- `SSEEvent` discriminated union (6 variants)
- `LogEntry` interface: `{ chunk, timestamp }`
- `AgentLogsState` interface: `{ planner: LogEntry[], coder: LogEntry[], reviewer: LogEntry[] }`

**Stories**: All (US-025 -- US-032) -- types are foundational to every implementation file
**Business Rules**: BR-04-005, BR-04-006, BR-04-007 (output schemas), BR-04-016 (token limits in AGENT_CONFIGS)
**Dependencies**: Requires `TaskStatus` type from `src/types/task.ts` (UOW-03)

---

### Step 3: Zod Validation Schemas

- [ ] **3.1** Create `src/lib/validations/pipeline-schemas.ts` -- all Zod schemas for agent output validation and API request validation

**File**: `src/lib/validations/pipeline-schemas.ts` (new)

Define the following schemas:

```
subtaskSchema          -- { id: string.min(1), title: string.min(1).max(200), description: string.min(1), order: number.int.min(1) }
subtaskListSchema      -- { subtasks: array(subtaskSchema).min(1).max(10) }
fileChangeSchema       -- { filePath: string.min(1), language: string.min(1), content: string, action: enum(create/modify/delete) }
fileChangesSchema      -- { files: array(fileChangeSchema) }
findingSchema          -- { severity: enum(error/warning/info), file: string.min(1), line: number.int.min(0), message: string.min(1) }
reviewResultSchema     -- { passed: boolean, score: number.min(0).max(100), findings: array(findingSchema) }
agentLogsSchema        -- { planner: array(string), coder: array(string), reviewer: array(string) }
errorDetailsSchema     -- { type: enum(api_error/parse_error/timeout/unknown), message: string, statusCode?: number, failedAgent?: enum(planner/coder/reviewer), failedPhase?: enum(planning/coding/reviewing/fixing), retryCount: number.int.min(0).default(0), maxRetries: number.int.default(3), timestamp: number }
startPipelineRequestSchema   -- validates taskId param and x-anthropic-key header
requestChangesSchema         -- { feedback: string.min(1).max(5000) }
```

Export:
- All schemas as named exports
- Inferred types via `z.infer<typeof schema>` for each schema
- `parseAgentJSON(text: string)` utility function that extracts JSON from markdown code blocks before parsing
- `validateAgentOutput<T>(text: string, schema: ZodSchema<T>): T` wrapper that combines extraction + validation

**Stories**: US-026 (BR-04-005), US-027 (BR-04-006), US-028 (BR-04-007)
**Business Rules**: BR-04-005 (planner output validation), BR-04-006 (coder output validation), BR-04-007 (reviewer output validation)
**NFRs**: NFR-04-006 (API key format validation)
**Testing Notes**:
- Test valid JSON parsing for each schema
- Test extraction from markdown code blocks (` ```json ... ``` `)
- Test rejection of invalid/incomplete JSON
- Test boundary values (0 subtasks, 11 subtasks, score -1, score 101)

---

### Step 4: Agent Prompt Files

- [ ] **4.1** Create `src/lib/prompts/planner-prompt.ts` -- system and user prompt builders for PlannerAgent

**File**: `src/lib/prompts/planner-prompt.ts` (new)

Exports:
- `buildPlannerSystemPrompt(): string` -- Role: "You are a senior software architect..." Output format: JSON conforming to SubtaskList schema. Constraints: max 10 subtasks, each self-contained, ordered by dependency.
- `buildPlannerUserPrompt(task: { title: string, description: string, category: string }): string` -- Formats task context for the planner.

- [ ] **4.2** Create `src/lib/prompts/coder-prompt.ts` -- system and user prompt builders for CoderAgent

**File**: `src/lib/prompts/coder-prompt.ts` (new)

Exports:
- `buildCoderSystemPrompt(): string` -- Role: "You are a senior full-stack developer..." Output format: JSON conforming to FileChanges schema. Constraints: production-quality code, proper error handling, TypeScript.
- `buildCoderUserPrompt(params: { subtask: Subtask | null, taskContext: { title, description, category }, previousOutputs: FileChanges, reviewFindings?: ReviewResult }): string` -- Formats subtask, context, and optional review findings for fix mode.

- [ ] **4.3** Create `src/lib/prompts/reviewer-prompt.ts` -- system and user prompt builders for ReviewerAgent

**File**: `src/lib/prompts/reviewer-prompt.ts` (new)

Exports:
- `buildReviewerSystemPrompt(): string` -- Role: "You are a senior code reviewer..." Review criteria: correctness, completeness, code quality, security. Output format: JSON conforming to ReviewResult schema. Scoring: 0-100, pass threshold = 70.
- `buildReviewerUserPrompt(params: { fileChanges: FileChanges, task: { title, description, category }, subtaskList: SubtaskList }): string` -- Formats all file changes, task context, and subtask list for review.

**Stories**: US-026, US-027, US-028
**Business Rules**: BR-04-016 (token limits defined in AGENT_CONFIGS, referenced by agents)
**NFRs**: NFR-04-017 (prompts in separate files, no inline prompt strings in orchestrator)
**Testing Notes**:
- Verify prompt builders return non-empty strings
- Verify system prompts include JSON schema instructions
- Verify user prompts include all provided context
- Verify coder prompt includes review findings when in fix mode

---

### Step 5: Agent Base Utilities

- [ ] **5.1** Create `src/lib/agents/agent-base.ts` -- shared streaming utilities, JSON extraction, and error handling for all agents

**File**: `src/lib/agents/agent-base.ts` (new)

Exports:
- `AgentExecuteParams` interface: `{ apiKey, taskId, onChunk: (chunk: string) => void, abortSignal?: AbortSignal }`
- `AgentResult<T>` interface: `{ output: T, tokenUsage: { input: number, output: number }, durationMs: number }`
- `createAnthropicClient(apiKey: string): Anthropic` -- creates Anthropic client instance per request (never shared)
- `streamAgentResponse(params: { client: Anthropic, model: string, maxTokens: number, systemPrompt: string, userPrompt: string, taskId: string, agentType: AgentType, onChunk: (chunk: string) => void, abortSignal?: AbortSignal }): Promise<{ fullText: string, tokenUsage: { input: number, output: number }, durationMs: number }>` -- handles streaming loop, chunk forwarding to SSE via onChunk, accumulation, and timing
- `extractJSON(text: string): string` -- extracts JSON from markdown code blocks or raw text
- `sanitizeAgentOutput(text: string): string` -- HTML entity escaping for stored logs (NFR-04-007)

- [ ] **5.2** Create `src/lib/utils/retry.ts` -- generic exponential backoff retry utility

**File**: `src/lib/utils/retry.ts` (new)

Exports:
- `withRetry<T>(fn: () => Promise<T>, options: { maxRetries: number, baseDelay: number, onRetry?: (attempt: number, delay: number) => void }): Promise<T>` -- retry with exponential backoff (delay = baseDelay * 2^attempt). Delays: 1000ms, 2000ms, 4000ms.

**Stories**: US-026, US-027, US-028 (streaming), US-029 (auto-fix retry)
**Business Rules**: BR-04-017 (exponential backoff: 1s, 2s, 4s)
**NFRs**: NFR-04-007 (output sanitization), NFR-04-014 (exponential backoff), NFR-04-003 (non-blocking -- all async/await)
**Testing Notes**:
- Test `extractJSON` with raw JSON, JSON in ` ```json ... ``` ` blocks, JSON with surrounding text
- Test `sanitizeAgentOutput` with `<script>` tags, HTML entities
- Test `withRetry` executes correct number of attempts with correct delays
- Test `createAnthropicClient` produces an Anthropic instance

---

### Step 6: PlannerAgent Service

- [ ] **6.1** Create `src/lib/agents/planner-agent.ts` -- PlannerAgent wrapper

**File**: `src/lib/agents/planner-agent.ts` (new)

Exports:
- `executePlannerAgent(params: { task: { title, description, category }, apiKey: string, taskId: string, onChunk: (chunk: string) => void, abortSignal?: AbortSignal }): Promise<AgentResult<SubtaskList>>`

Implementation:
1. Build system prompt via `buildPlannerSystemPrompt()`
2. Build user prompt via `buildPlannerUserPrompt(task)`
3. Create Anthropic client via `createAnthropicClient(apiKey)`
4. Call `streamAgentResponse()` with model `claude-sonnet-4-20250514`, maxTokens 4096
5. Extract JSON from accumulated text via `extractJSON()`
6. Validate against `subtaskListSchema` (Zod)
7. On parse failure: retry ONCE with appended instruction "Respond with ONLY valid JSON matching the schema."
8. Return `AgentResult<SubtaskList>`

**Stories**: US-026 (Planner Agent Generates Subtasks)
**Business Rules**: BR-04-005 (planner output schema conformance), BR-04-016 (max_tokens 4096)
**NFRs**: NFR-04-001 (SSE event latency < 500ms -- streaming forwarded immediately), NFR-04-018 (structured logging with taskId)
**Testing Notes**:
- Mock Anthropic SDK to return valid SubtaskList JSON
- Test parse failure triggers single retry with explicit JSON instruction
- Test abort signal cancels streaming
- Verify onChunk is called for each text delta

---

### Step 7: CoderAgent Service

- [ ] **7.1** Create `src/lib/agents/coder-agent.ts` -- CoderAgent wrapper

**File**: `src/lib/agents/coder-agent.ts` (new)

Exports:
- `executeCoderAgent(params: { subtask: Subtask | null, taskContext: { title, description, category }, previousOutputs: FileChanges, reviewFindings?: ReviewResult, apiKey: string, taskId: string, onChunk: (chunk: string) => void, abortSignal?: AbortSignal }): Promise<AgentResult<FileChanges>>`

Implementation:
1. Build system prompt via `buildCoderSystemPrompt()`
2. Build user prompt via `buildCoderUserPrompt({ subtask, taskContext, previousOutputs, reviewFindings })`
3. Create Anthropic client via `createAnthropicClient(apiKey)`
4. Call `streamAgentResponse()` with model `claude-sonnet-4-20250514`, maxTokens 8192
5. Extract JSON from accumulated text via `extractJSON()`
6. Validate against `fileChangesSchema` (Zod)
7. On parse failure: retry ONCE with explicit JSON instruction
8. Return `AgentResult<FileChanges>`

**Auto-Fix Mode**: When `reviewFindings` is provided, the user prompt includes the review findings for the coder to address. When `subtask` is null, the coder operates on the full task scope (used in FIXING phase).

**Stories**: US-027 (Coder Agent Generates File Changes), US-029 (Auto-Fix on Review Failure -- coder receives findings)
**Business Rules**: BR-04-006 (coder output schema conformance), BR-04-016 (max_tokens 8192)
**NFRs**: NFR-04-001 (SSE event latency), NFR-04-018 (structured logging)
**Testing Notes**:
- Mock Anthropic SDK to return valid FileChanges JSON
- Test normal mode (with subtask) and fix mode (with reviewFindings, null subtask)
- Test parse failure triggers single retry
- Verify file changes include filePath, language, content, action for each file

---

### Step 8: ReviewerAgent Service

- [ ] **8.1** Create `src/lib/agents/reviewer-agent.ts` -- ReviewerAgent wrapper

**File**: `src/lib/agents/reviewer-agent.ts` (new)

Exports:
- `executeReviewerAgent(params: { fileChanges: FileChanges, task: { title, description, category }, subtaskList: SubtaskList, apiKey: string, taskId: string, onChunk: (chunk: string) => void, abortSignal?: AbortSignal }): Promise<AgentResult<ReviewResult>>`

Implementation:
1. Build system prompt via `buildReviewerSystemPrompt()`
2. Build user prompt via `buildReviewerUserPrompt({ fileChanges, task, subtaskList })`
3. Create Anthropic client via `createAnthropicClient(apiKey)`
4. Call `streamAgentResponse()` with model `claude-sonnet-4-20250514`, maxTokens 4096
5. Extract JSON from accumulated text via `extractJSON()`
6. Validate against `reviewResultSchema` (Zod)
7. On parse failure: retry ONCE with explicit JSON instruction
8. Return `AgentResult<ReviewResult>`

**Pass/Fail Decision**: `passed === true` AND `score >= 70` constitutes a pass. The orchestrator reads `result.output.passed` as the authoritative verdict.

**Stories**: US-028 (Reviewer Agent Validates Output)
**Business Rules**: BR-04-007 (reviewer output schema conformance), BR-04-016 (max_tokens 4096)
**NFRs**: NFR-04-001 (SSE event latency), NFR-04-018 (structured logging)
**Testing Notes**:
- Mock Anthropic SDK to return valid ReviewResult JSON (both pass and fail scenarios)
- Test pass threshold: score 70 + passed true = pass; score 69 + passed false = fail
- Test findings array with all severity levels
- Test parse failure triggers single retry

---

### Step 9: SSEService (In-Memory Connection Registry)

- [ ] **9.1** Create `src/lib/services/sse-service.ts` -- singleton SSE connection manager

**File**: `src/lib/services/sse-service.ts` (new)

Exports:
- `sseService` (singleton instance)

Class `SSEService`:

State:
- `connections: Map<string, Set<WritableStreamDefaultWriter>>` -- keyed by taskId

Methods:
- `register(taskId: string, writer: WritableStreamDefaultWriter): void` -- add writer to connections set for taskId
- `unregister(taskId: string, writer: WritableStreamDefaultWriter): void` -- remove writer from set; delete set if empty
- `push(taskId: string, event: SSEEvent): void` -- encode event in SSE wire format (`event: <type>\ndata: <json>\n\n`) and write to ALL registered writers for taskId. Silently catch write errors (client disconnected).
- `closeAll(taskId: string): void` -- close all writers for taskId and remove from map
- `getConnectionCount(taskId: string): number` -- return number of active connections for taskId (useful for monitoring)

Wire Format:
```
event: <event-type>\n
data: <JSON.stringify(event.data)>\n
\n
```

**Stories**: US-025 -- US-032 (all stories rely on SSE for real-time events)
**Business Rules**: BR-04-015 (10-minute timeout -- enforced in SSE route, not in service)
**NFRs**: NFR-04-015 (in-memory Map, document Redis scaling path via code comment), NFR-04-004 (keepalive -- enforced in SSE route)
**Testing Notes**:
- Test register/unregister correctly manages connection sets
- Test push broadcasts to all registered writers for a given taskId
- Test push does not throw when writer is already closed (graceful handling)
- Test closeAll properly closes and removes all writers
- Test push to non-existent taskId is a no-op (no error)

---

### Step 10: PipelineOrchestrator (State Machine)

- [ ] **10.1** Create `src/lib/services/pipeline-orchestrator.ts` -- the core state machine and agent coordination service

**File**: `src/lib/services/pipeline-orchestrator.ts` (new)

Exports:
- `pipelineOrchestrator` (singleton instance)

Class `PipelineOrchestrator`:

State:
- `activeRuns: Map<string, AbortController>` -- keyed by taskId, used for cancellation

Methods:

- `execute(runId: string, taskId: string, apiKey: string): Promise<void>` (ASYNC -- does not block caller)

  Full execution sequence:
  1. Load PipelineRun from DB by runId
  2. Create AbortController, store in activeRuns by taskId
  3. **PLANNING phase**:
     - Update PipelineRun.phase = "planning" in DB
     - Push SSE: `phase-change { phase: "planning", status: "running", iteration: 0 }`
     - Call `executePlannerAgent()` with onChunk -> `sseService.push(taskId, { type: "agent-log", data: { agent: "planner", chunk, timestamp } })`
     - Store subtasks on Task record (`Task.subtasks` JSON field)
     - Store planner log summary in `PipelineRun.agentLogs.planner`
  4. **CODING phase**:
     - Update Task status to "building" via TaskService (BR-04-009)
     - Update PipelineRun.phase = "coding" in DB
     - Push SSE: `phase-change { phase: "coding", ... }`
     - Push SSE: `task-status { taskId, newStatus: "building" }`
     - For each subtask in order: call `executeCoderAgent()` with onChunk -> SSE agent-log
     - Accumulate all file changes across subtasks
     - Store accumulated file changes in `PipelineRun.fileChanges`
  5. **REVIEWING phase**:
     - Update PipelineRun.phase = "reviewing" in DB
     - Push SSE: `phase-change { phase: "reviewing", ... }`
     - Call `executeReviewerAgent()` with onChunk -> SSE agent-log
     - Store review result in `PipelineRun.reviewFindings`
  6. **Evaluate ReviewResult**:
     - If `passed === true`:
       - Set phase = "completed", status = "passed"
       - Update Task status to "review" (BR-04-010)
       - Push SSE: `task-status { taskId, newStatus: "review" }`
       - Push SSE: `pipeline-complete { taskId, result: "passed", fileChanges, reviewFindings }`
       - Set `PipelineRun.completedAt = now()`
     - If `passed === false` AND `iteration < 2`:
       - Increment `PipelineRun.iteration`
       - Enter FIXING phase (step 7)
     - If `passed === false` AND `iteration >= 2`:
       - Set phase = "failed", status = "failed"
       - Update Task status to "backlog" (BR-04-012)
       - Push SSE: `task-status { taskId, newStatus: "backlog" }`
       - Push SSE: `pipeline-complete { taskId, result: "failed" }`
       - Set `PipelineRun.completedAt = now()`
  7. **FIXING phase** (auto-fix loop):
     - Push SSE: `phase-change { phase: "fixing", iteration }`
     - Push SSE: `agent-log { agent: "coder", chunk: "Review failed -- auto-fixing (attempt X/3)" }`
     - Call `executeCoderAgent()` with `reviewFindings` parameter and `subtask: null` (full task scope)
     - Merge/replace file changes in `PipelineRun.fileChanges`
     - Return to step 5 (REVIEWING)
  8. **Cleanup**: Remove taskId from `activeRuns` map

- `cancel(taskId: string): Promise<void>`
  1. Retrieve AbortController from `activeRuns`
  2. Call `controller.abort()` to cancel in-flight agent streaming
  3. Update PipelineRun: phase = "cancelled", status = "cancelled", completedAt = now()
  4. Update Task status to "backlog"
  5. Push SSE: `phase-change { phase: "cancelled" }`
  6. Push SSE: `task-status { taskId, newStatus: "backlog" }`
  7. Remove from `activeRuns`

- `retry(taskId: string, apiKey: string): Promise<void>`
  1. Load PipelineRun (must be status "paused")
  2. Increment retryCount on errorDetails
  3. Calculate backoff delay: `1000 * Math.pow(2, retryCount)` (BR-04-017)
  4. Push SSE: `agent-log { agent: failedAgent, chunk: "Retrying in Xs..." }`
  5. Wait for delay
  6. Update PipelineRun.status = "running", clear errorDetails
  7. Resume execution from the failed phase/agent
  8. If retry also fails and retryCount >= 3: transition to FAILED

- `isRunning(taskId: string): boolean` -- check if taskId has an active run in `activeRuns`

**Error Handling**:
- Wrap all agent calls in try/catch
- On Anthropic `AuthenticationError`: terminate pipeline, push SSE error (not retryable)
- On Anthropic `RateLimitError` / `APIError`: pause pipeline, push SSE error (retryable), store error details
- On JSON parse error (after single agent-level retry): pause pipeline, push SSE error (retryable)
- On AbortError (cancellation): clean exit, no error event

**Stories**: US-025 (start), US-026 (planner), US-027 (coder), US-028 (reviewer), US-029 (auto-fix), US-030 (success), US-031 (failure), US-032 (cancel)
**Business Rules**: BR-04-001 (start precondition -- checked in API route), BR-04-002 (one active pipeline -- checked in API route), BR-04-003 (max 3 iterations), BR-04-008 (task -> spec on start), BR-04-009 (task -> building on coding), BR-04-010 (task -> review on pass), BR-04-011 (task stays building on fix), BR-04-012 (task -> backlog on fail), BR-04-014 (cancel at any phase), BR-04-017 (exponential backoff)
**NFRs**: NFR-04-002 (pipeline start < 1s -- orchestrator runs async), NFR-04-003 (non-blocking -- all async/await), NFR-04-010 (DB write at every phase transition), NFR-04-012 (rate limit handling), NFR-04-013 (10-minute timeout via AbortController), NFR-04-018 (structured logging with taskId/pipelineId)
**Testing Notes**:
- Test full happy path: PLANNING -> CODING -> REVIEWING -> COMPLETED
- Test auto-fix loop: REVIEWING (fail) -> FIXING -> REVIEWING (pass) -> COMPLETED
- Test max iterations: 3 review failures -> FAILED
- Test cancellation: abort during each phase
- Test API error -> PAUSED -> retry -> resume
- Test concurrent pipeline rejection (via isRunning check)
- Verify DB state is persisted at each phase transition
- Verify SSE events are pushed at each transition
- Verify Task status transitions match BR-04-008 through BR-04-012

---

### Step 11: Pipeline API Routes

- [ ] **11.1** Create `src/app/api/tasks/[id]/start-pipeline/route.ts` -- POST endpoint to start a pipeline

**File**: `src/app/api/tasks/[id]/start-pipeline/route.ts` (new)

Implementation:
1. Authenticate user via session cookie (middleware)
2. Extract and validate `x-anthropic-key` header (BR-04-004): present, non-empty, starts with `sk-ant-`
3. Validate `id` param format
4. Fetch task from DB; verify existence and ownership (via project chain: Task -> Project -> User). Return 404 if not found/not owned (NFR-04-008).
5. Check task status is "backlog" or "spec" (BR-04-001). Return 400 if not.
6. Check no active pipeline exists for this task (BR-04-002). Return 409 if exists.
7. Check concurrent pipeline limit (max 5 per user, NFR-04-009). Return 429 if exceeded.
8. Create PipelineRun record in DB with defaults
9. Update Task status to "spec" (BR-04-008)
10. Return `202 Accepted` with `{ runId: pipelineRun.id }`
11. Start `pipelineOrchestrator.execute(runId, taskId, apiKey)` asynchronously (do NOT await)

Error responses:
| Condition | HTTP | Body |
|-----------|------|------|
| Task not found / not owned | 404 | `{ error: "Task not found" }` |
| Task not in backlog/spec | 400 | `{ error: "Pipeline can only start on tasks in Backlog or Spec status" }` |
| Active pipeline exists | 409 | `{ error: "A pipeline is already running for this task" }` |
| Missing/invalid API key | 400 | `{ error: "Valid Anthropic API key required" }` |
| Max concurrent pipelines | 429 | `{ error: "Maximum concurrent pipelines reached" }` |
| Invalid task ID | 400 | `{ error: "Invalid task ID" }` |

- [ ] **11.2** Create `src/app/api/pipeline/[taskId]/status/route.ts` -- GET endpoint for pipeline status

**File**: `src/app/api/pipeline/[taskId]/status/route.ts` (new)

Implementation:
1. Authenticate user, validate task ownership
2. Fetch latest PipelineRun for taskId (ordered by `startedAt DESC`)
3. If no runs exist: return `200` with `{ status: "none" }`
4. Return `200` with: `{ runId, phase, iteration, status, agentLogCounts: { planner, coder, reviewer }, hasFileChanges, reviewScore, startedAt, completedAt, errorDetails }`

- [ ] **11.3** Create `src/app/api/pipeline/[taskId]/retry/route.ts` -- POST endpoint to retry a paused pipeline

**File**: `src/app/api/pipeline/[taskId]/retry/route.ts` (new)

Implementation:
1. Authenticate user, validate task ownership
2. Fetch PipelineRun; validate `status === "paused"`
3. Validate `errorDetails.retryCount < 3`
4. Extract `x-anthropic-key` header (needed for retry)
5. Call `pipelineOrchestrator.retry(taskId, apiKey)` asynchronously
6. Return `202 Accepted`

- [ ] **11.4** Create `src/app/api/pipeline/[taskId]/cancel/route.ts` -- POST endpoint to cancel an active pipeline

**File**: `src/app/api/pipeline/[taskId]/cancel/route.ts` (new)

Implementation:
1. Authenticate user, validate task ownership
2. Fetch PipelineRun; validate `status IN ("running", "paused")` (BR-04-014)
3. Call `pipelineOrchestrator.cancel(taskId)`
4. Return `200 OK` with `{ status: "cancelled" }`

Error: If no active pipeline: return `400` with `{ error: "No active pipeline to cancel" }`

- [ ] **11.5** Create `src/app/api/pipeline/[taskId]/approve/route.ts` -- POST endpoint to approve a completed pipeline

**File**: `src/app/api/pipeline/[taskId]/approve/route.ts` (new)

Implementation:
1. Authenticate user, validate task ownership
2. Fetch PipelineRun; validate `status === "passed"` and task `status === "review"`
3. Update Task status to "done" (BR-04-013)
4. Push SSE: `task-status { taskId, newStatus: "done" }`
5. Return `200 OK`

Error: If precondition fails: return `400` with `{ error: "Task must be in Review status to approve" }`

- [ ] **11.6** Create `src/app/api/pipeline/[taskId]/request-changes/route.ts` -- POST endpoint to request changes with feedback

**File**: `src/app/api/pipeline/[taskId]/request-changes/route.ts` (new)

Implementation:
1. Authenticate user, validate task ownership
2. Fetch PipelineRun; validate `status === "passed"` and task `status === "review"`
3. Validate request body against `requestChangesSchema` (Zod): `{ feedback: string }`
4. Extract `x-anthropic-key` header
5. Increment `PipelineRun.iteration`
6. Update Task status to "building"
7. Resume pipeline from CODING phase with human feedback as additional context
8. Return `202 Accepted`

**Stories**: US-025 (start), US-030 (success/approve), US-031 (fail), US-032 (cancel)
**Business Rules**: BR-04-001, BR-04-002, BR-04-004, BR-04-008, BR-04-013, BR-04-014
**NFRs**: NFR-04-002 (start < 1s), NFR-04-005 (API key per-request), NFR-04-006 (API key validation), NFR-04-008 (ownership enforcement, 404 for unauthorized), NFR-04-009 (rate limiting 5 concurrent)
**Testing Notes**:
- Test start-pipeline with missing API key -> 400
- Test start-pipeline with invalid API key format -> 400
- Test start-pipeline on task not in backlog/spec -> 400
- Test start-pipeline with active pipeline -> 409
- Test start-pipeline returns 202 with runId
- Test cancel on non-active pipeline -> 400
- Test cancel on running pipeline -> 200, verify task status reverted to backlog
- Test retry on non-paused pipeline -> 400
- Test status with no pipeline runs -> `{ status: "none" }`
- Test approve on non-review task -> 400
- Test ownership enforcement: user A cannot access user B's pipeline -> 404
- `data-testid` attributes: not applicable (API routes)

---

### Step 12: SSE API Route

- [ ] **12.1** Create `src/app/api/sse/[taskId]/route.ts` -- GET endpoint for SSE streaming

**File**: `src/app/api/sse/[taskId]/route.ts` (new)

Implementation:
1. Authenticate user via session cookie
2. Validate taskId param and task ownership
3. Create `TransformStream`
4. Get writer from writable side
5. Register writer with `sseService.register(taskId, writer)`
6. Set up keepalive interval (every 30 seconds): write `": keepalive\n\n"` to stream (NFR-04-004)
7. Set up 10-minute connection timeout (BR-04-015): push `{ type: "timeout", data: { message: "Connection timed out. Reconnect if pipeline is still running." } }` then close stream
8. Set up cleanup on `req.signal` abort:
   - Clear keepalive interval
   - Clear timeout timer
   - `sseService.unregister(taskId, writer)`
   - Close writer
9. Return `Response` with readable side and headers:
   - `Content-Type: text/event-stream`
   - `Cache-Control: no-cache`
   - `Connection: keep-alive`
   - `X-Accel-Buffering: no` (for nginx/reverse proxies)

```typescript
export const dynamic = "force-dynamic"; // Disable Next.js caching for SSE
export const runtime = "nodejs";        // Ensure Node.js runtime (not Edge)
```

**Stories**: US-025 -- US-032 (all stories use SSE for real-time communication)
**Business Rules**: BR-04-015 (10-minute timeout)
**NFRs**: NFR-04-001 (event latency < 500ms), NFR-04-004 (30s keepalive), NFR-04-008 (ownership enforcement), NFR-04-015 (in-memory connection management)
**Testing Notes**:
- Test SSE connection returns correct headers (Content-Type, Cache-Control)
- Test keepalive comments are sent every 30 seconds
- Test connection closes after 10 minutes with timeout event
- Test cleanup on client disconnect (no memory leak)
- Test unauthorized access returns 404
- Test multiple clients can connect to same taskId (broadcast)

---

### Step 13: Pipeline Store (Zustand)

- [ ] **13.1** Create `src/stores/pipeline-store.ts` -- Zustand store with immer middleware

**File**: `src/stores/pipeline-store.ts` (new)

State:
```typescript
interface PipelineStoreState {
  pipelineRuns: Map<string, PipelineRunState>;  // key: taskId
  agentLogs: Map<string, AgentLogsState>;       // key: taskId
}
```

Actions:
- `startPipeline(taskId: string, runId: string): void` -- initialize pipelineRuns and agentLogs entries
- `updatePhase(taskId: string, phase: PipelinePhase, status: PipelineStatus, iteration: number): void` -- update phase/status/iteration on pipelineRuns entry
- `appendLog(taskId: string, agent: AgentType, chunk: string, timestamp: number): void` -- push LogEntry to agentLogs[taskId][agent]
- `setError(taskId: string, errorDetails: ErrorDetails): void` -- set errorDetails and status = "paused"
- `setComplete(taskId: string, result: "passed" | "failed", fileChanges?: FileChanges, reviewFindings?: ReviewResult): void` -- set final status, store fileChanges/reviewFindings, set completedAt
- `retryPipeline(taskId: string): void` -- optimistic: clear errorDetails, set status = "running"
- `cancelPipeline(taskId: string): void` -- optimistic: set status/phase = "cancelled"
- `clearLogs(taskId: string): void` -- reset agentLogs[taskId] to empty arrays
- `removePipeline(taskId: string): void` -- delete from both maps

Selectors (exported as standalone hooks):
- `usePipelineRun(taskId: string)` -- returns `pipelineRuns.get(taskId) ?? null`
- `useAgentLogs(taskId: string)` -- returns `agentLogs.get(taskId) ?? null`
- `useAnyPipelineRunning()` -- returns boolean: any run with status "running"

**Stories**: All (US-025 -- US-032) -- store is the client-side state mirror
**Dependencies**: Zustand (installed in UOW-01), immer middleware
**Testing Notes**:
- Test startPipeline initializes correct default state
- Test updatePhase correctly updates phase, status, iteration
- Test appendLog pushes to correct agent array
- Test setError sets errorDetails and status to "paused"
- Test setComplete with "passed" and "failed" results
- Test cancelPipeline sets status and phase to "cancelled"
- Test removePipeline cleans up both maps
- Test selectors return null for non-existent taskIds

---

### Step 14: useSSE Hook

- [ ] **14.1** Create `src/hooks/use-sse.ts` -- EventSource connection with auto-reconnect and event dispatch

**File**: `src/hooks/use-sse.ts` (new)

Interface:
```typescript
interface UseSSEOptions {
  taskId: string | null;   // null = no connection
  enabled?: boolean;       // default: true
}

interface UseSSEReturn {
  isConnected: boolean;
  error: string | null;
  reconnect: () => void;
}
```

Implementation:
1. `useEffect` watches `taskId` and `enabled`
2. If `taskId` is non-null and `enabled`:
   - Create `EventSource` at `/api/sse/${taskId}` (with credentials if needed)
   - Register event listeners for each named event type:
     - `agent-log` -> `pipelineStore.appendLog()`
     - `phase-change` -> `pipelineStore.updatePhase()`
     - `task-status` -> `taskStore.updateTaskStatus()`
     - `error` -> `pipelineStore.setError()`
     - `pipeline-complete` -> `pipelineStore.setComplete()`
     - `timeout` -> close connection, attempt reconnect if pipeline still active
   - Set `onopen` -> `isConnected = true`, reset reconnect counter
   - Set `onerror` -> `isConnected = false`, auto-reconnect with exponential backoff (1s, 2s, 4s), max 3 attempts
3. Cleanup on unmount or taskId/enabled change:
   - `eventSource.close()`
   - `isConnected = false`

**Stories**: US-025 -- US-032 (all SSE-dependent)
**Business Rules**: BR-04-015 (timeout reconnection)
**NFRs**: NFR-04-011 (auto-reconnect, max 3 attempts, exponential backoff)
**Testing Notes**:
- Test connection established when taskId is provided
- Test no connection when taskId is null or enabled is false
- Test events are dispatched to correct store actions
- Test auto-reconnect on connection error (up to 3 attempts)
- Test cleanup on unmount (EventSource.close called)
- Test reconnect counter resets on successful connection
- `data-testid` attributes: not applicable (hook, no DOM)

---

### Step 15: usePipeline Hook

- [ ] **15.1** Create `src/hooks/use-pipeline.ts` -- pipeline action wrapper with loading states and API calls

**File**: `src/hooks/use-pipeline.ts` (new)

Interface:
```typescript
interface UsePipelineOptions {
  taskId: string;
}

interface UsePipelineReturn {
  // State (from pipelineStore selectors)
  pipelineRun: PipelineRunState | null;
  agentLogs: AgentLogsState | null;
  isRunning: boolean;          // derived: status === "running"
  isPaused: boolean;           // derived: status === "paused"
  isCompleted: boolean;        // derived: status in ("passed", "failed", "cancelled")

  // Actions
  startPipeline: () => Promise<void>;
  retryPipeline: () => Promise<void>;
  cancelPipeline: () => Promise<void>;
  approvePipeline: () => Promise<void>;
  requestChanges: (feedback: string) => Promise<void>;

  // Loading states (per action)
  isStarting: boolean;
  isRetrying: boolean;
  isCancelling: boolean;
  isApproving: boolean;
  isRequestingChanges: boolean;

  // Error
  actionError: string | null;
}
```

Implementation:
- Reads from `pipelineStore` via selectors: `usePipelineRun(taskId)`, `useAgentLogs(taskId)`
- Derives `isRunning`, `isPaused`, `isCompleted` from `pipelineRun?.status`
- Each action:
  1. Set per-action loading state to true
  2. Clear `actionError`
  3. Make fetch call to appropriate API endpoint
  4. On success: update store (optimistic for cancel/retry) or wait for SSE
  5. On failure: set `actionError` from response body
  6. Set per-action loading state to false

**API Key Handling** (for startPipeline):
```typescript
const apiKey = getDecryptedApiKey(); // from localStorage utility (UOW-01)
if (!apiKey) {
  setActionError("API key required. Configure in Settings.");
  return;
}
// Include: headers: { "x-anthropic-key": apiKey }
```

**Stories**: US-025 (start), US-030 (approve), US-032 (cancel)
**Business Rules**: BR-04-001, BR-04-002, BR-04-004, BR-04-014
**Testing Notes**:
- Test startPipeline calls correct endpoint with API key header
- Test startPipeline without API key sets actionError
- Test loading states toggle correctly during API calls
- Test error from API response is captured in actionError
- Test derived boolean states (isRunning, isPaused, isCompleted)

---

### Step 16: PipelineControls Component

- [ ] **16.1** Create `src/components/pipeline/pipeline-controls.tsx` -- client component with context-appropriate action buttons

**File**: `src/components/pipeline/pipeline-controls.tsx` (new)

```typescript
"use client";

interface PipelineControlsProps {
  taskId: string;
}
```

Implementation:
- Uses `usePipeline(taskId)` hook for all state and actions
- Uses `useSSE({ taskId, enabled: isRunning || isPaused })` to establish/maintain SSE connection during active pipeline

Rendered states:

| Pipeline State | Buttons Shown | data-testid |
|---------------|---------------|-------------|
| No pipeline (null) | [Start Pipeline] | `data-testid="btn-start-pipeline"` |
| Running | [Cancel Pipeline] | `data-testid="btn-cancel-pipeline"` |
| Paused (error) | [Retry] [Cancel] | `data-testid="btn-retry-pipeline"`, `data-testid="btn-cancel-pipeline"` |
| Completed (passed) | [Approve] [Request Changes] | `data-testid="btn-approve-pipeline"`, `data-testid="btn-request-changes"` |
| Failed | [Start Pipeline] (restart) | `data-testid="btn-start-pipeline"` |
| Cancelled | [Start Pipeline] (restart) | `data-testid="btn-start-pipeline"` |

UI Elements:
- `<Button>` (shadcn/ui) for each action, with `Loader2` spinner when loading
- `<AlertDialog>` (shadcn/ui) for destructive actions: Cancel Pipeline, Retry from scratch
- `<Textarea>` (shadcn/ui) inside a `<Dialog>` for "Request Changes" feedback
- `<Tooltip>` (shadcn/ui) on disabled buttons with explanation text
- Wrapper `<div data-testid="pipeline-controls">`

**Stories**: US-025 (start button), US-030 (approve), US-032 (cancel button)
**Business Rules**: BR-04-001 (start only from backlog/spec), BR-04-002 (no duplicate pipelines), BR-04-014 (cancel at any phase)
**Dependencies**: shadcn/ui Button, AlertDialog, Dialog, Textarea, Tooltip (installed in UOW-01)
**Testing Notes**:
- Test "Start Pipeline" button visible when no pipeline exists
- Test "Cancel Pipeline" button visible during running state
- Test "Retry"/"Cancel" buttons visible during paused state
- Test "Approve"/"Request Changes" buttons visible when completed (passed)
- Test "Start Pipeline" button visible after failed/cancelled
- Test loading spinner shows during API calls
- Test confirmation dialog appears before cancel/retry-from-scratch
- Test "Request Changes" opens feedback dialog with textarea
- Verify all `data-testid` attributes are present

---

### Step 17: ErrorNotification Component

- [ ] **17.1** Create `src/components/pipeline/error-notification.tsx` -- error banner and toast for pipeline errors

**File**: `src/components/pipeline/error-notification.tsx` (new)

```typescript
"use client";

interface ErrorNotificationProps {
  taskId: string;
}
```

Implementation:
- Reads from `pipelineStore`: `pipelineRuns.get(taskId).errorDetails`
- Uses `usePipeline(taskId)` for retry/cancel actions
- Local state: `isVisible` (banner dismissible)

Trigger condition: Renders when `pipelineRun?.status === "paused"` AND `errorDetails !== null`

Display layout:
```
+--------------------------------------------------------------+
| [AlertTriangle] Pipeline Error                         [X]    |
|                                                               |
| {errorDetails.message}                                        |
| Agent: {failedAgent} | Phase: {failedPhase} | Retry {n}/3    |
|                                                               |
| [Retry]  [Cancel Pipeline]                                    |
+--------------------------------------------------------------+
```

UI Elements:
- Sonner `toast.error()` fired on new error event (auto-dismiss 10s)
- Inline `<Alert variant="destructive">` (shadcn/ui) for persistent banner
- `AlertTriangle` icon from Lucide
- Retry countdown display: "Retrying in Xs..." (from SSE agent-log during backoff)
- Wrapper `<div data-testid="error-notification">`
- Retry button: `data-testid="btn-error-retry"`
- Cancel button: `data-testid="btn-error-cancel"`
- Dismiss button: `data-testid="btn-error-dismiss"`

**Stories**: US-025 -- US-032 (error handling is cross-cutting)
**Business Rules**: BR-04-017 (backoff timing displayed), BR-04-004 (API key errors show "Update key in Settings" link)
**NFRs**: NFR-04-012 (rate limit handling surfaced to user)
**Dependencies**: shadcn/ui Alert, Sonner toast (installed in UOW-01), Lucide icons
**Testing Notes**:
- Test banner appears when pipelineRun.status is "paused" with errorDetails
- Test banner does not appear when status is "running" or "completed"
- Test "Retry" button calls retryPipeline action
- Test "Cancel" button calls cancelPipeline action
- Test dismiss button hides banner (but PipelineControls still shows actions)
- Test toast fires on new error event
- Test error message, agent, phase, retry count are displayed correctly
- Verify all `data-testid` attributes are present

---

### Step 18: Unit Tests

- [ ] **18.1** Create tests for Zod validation schemas

**File**: `src/lib/validations/__tests__/pipeline-schemas.test.ts` (new)

Test cases:
- `subtaskListSchema`: valid input, empty subtasks array, > 10 subtasks, missing fields, invalid order
- `fileChangesSchema`: valid input, invalid action enum, empty filePath
- `reviewResultSchema`: valid pass, valid fail, score out of range (< 0, > 100), invalid severity
- `errorDetailsSchema`: valid input, missing optional fields, invalid error type
- `parseAgentJSON`: raw JSON, JSON in code blocks, invalid JSON
- `requestChangesSchema`: valid feedback, empty feedback, overly long feedback

- [ ] **18.2** Create tests for agent prompt builders

**File**: `src/lib/prompts/__tests__/prompts.test.ts` (new)

Test cases:
- Each prompt builder returns non-empty string
- System prompts include JSON schema instructions
- User prompts include all provided context fields
- Coder user prompt includes review findings when provided
- Coder user prompt omits review findings when not provided

- [ ] **18.3** Create tests for agent base utilities

**File**: `src/lib/agents/__tests__/agent-base.test.ts` (new)

Test cases:
- `extractJSON`: raw JSON, JSON in markdown code blocks, JSON with surrounding text, no JSON found
- `sanitizeAgentOutput`: HTML tags escaped, normal text unchanged, XSS payloads neutralized
- `createAnthropicClient`: returns Anthropic instance

- [ ] **18.4** Create tests for PlannerAgent

**File**: `src/lib/agents/__tests__/planner-agent.test.ts` (new)

Test cases (mock Anthropic SDK):
- Happy path: valid SubtaskList returned
- Parse failure: first attempt fails, retry succeeds with valid JSON
- Parse failure: both attempts fail, throws error
- Streaming: onChunk called for each text delta
- Abort signal: cancels streaming

- [ ] **18.5** Create tests for CoderAgent

**File**: `src/lib/agents/__tests__/coder-agent.test.ts` (new)

Test cases (mock Anthropic SDK):
- Happy path: valid FileChanges returned (normal mode)
- Auto-fix mode: reviewFindings included in prompt, valid FileChanges returned
- Parse failure and retry
- Streaming: onChunk called for each delta

- [ ] **18.6** Create tests for ReviewerAgent

**File**: `src/lib/agents/__tests__/reviewer-agent.test.ts` (new)

Test cases (mock Anthropic SDK):
- Happy path: review passes (score >= 70, passed true)
- Happy path: review fails (score < 70, passed false, findings populated)
- Parse failure and retry
- Streaming: onChunk called for each delta

- [ ] **18.7** Create tests for SSEService

**File**: `src/lib/services/__tests__/sse-service.test.ts` (new)

Test cases:
- `register`: adds writer to connection set
- `unregister`: removes writer; cleans up empty sets
- `push`: broadcasts to all registered writers for a taskId
- `push`: gracefully handles closed/errored writers
- `push`: no-op for unknown taskId
- `closeAll`: closes all writers and removes from map
- `getConnectionCount`: returns correct count

- [ ] **18.8** Create tests for PipelineOrchestrator

**File**: `src/lib/services/__tests__/pipeline-orchestrator.test.ts` (new)

Test cases (mock agents, DB, SSE):
- Full happy path: PLANNING -> CODING -> REVIEWING -> COMPLETED
- Auto-fix loop: review fail at iteration 0, fix -> review pass at iteration 1
- Max iterations: 3 review failures -> FAILED
- Cancellation during PLANNING phase
- Cancellation during CODING phase
- API error -> PAUSED state with correct errorDetails
- Retry from PAUSED -> resume execution
- Task status transitions verified at each phase (BR-04-008 through BR-04-012)
- SSE events pushed at each phase transition
- DB writes at each phase transition (NFR-04-010)

- [ ] **18.9** Create tests for pipeline API routes

**File**: `src/app/api/tasks/[id]/start-pipeline/__tests__/route.test.ts` (new)
**File**: `src/app/api/pipeline/[taskId]/status/__tests__/route.test.ts` (new)
**File**: `src/app/api/pipeline/[taskId]/cancel/__tests__/route.test.ts` (new)
**File**: `src/app/api/pipeline/[taskId]/retry/__tests__/route.test.ts` (new)
**File**: `src/app/api/pipeline/[taskId]/approve/__tests__/route.test.ts` (new)
**File**: `src/app/api/pipeline/[taskId]/request-changes/__tests__/route.test.ts` (new)

Test cases per route:
- Authentication required (no session -> 401)
- Ownership enforcement (other user's task -> 404, NFR-04-008)
- Business rule preconditions (correct HTTP error codes per rule)
- Happy path response format and status code
- Correct orchestrator method called

- [ ] **18.10** Create tests for pipelineStore (Zustand)

**File**: `src/stores/__tests__/pipeline-store.test.ts` (new)

Test cases:
- `startPipeline`: initializes correct default state in both maps
- `updatePhase`: updates phase, status, iteration
- `appendLog`: pushes to correct agent array
- `setError`: sets errorDetails and status to paused
- `setComplete` (passed): sets status, fileChanges, reviewFindings, completedAt
- `setComplete` (failed): sets status to failed
- `cancelPipeline`: sets status and phase to cancelled
- `removePipeline`: deletes from both maps
- Selectors: return null for non-existent taskIds

- [ ] **18.11** Create tests for useSSE hook

**File**: `src/hooks/__tests__/use-sse.test.ts` (new)

Test cases (mock EventSource):
- Connection established when taskId provided
- No connection when taskId is null
- No connection when enabled is false
- Events dispatched to correct store actions
- Auto-reconnect on error (up to 3 attempts with backoff)
- Cleanup on unmount
- Reconnect counter resets on successful message

- [ ] **18.12** Create tests for usePipeline hook

**File**: `src/hooks/__tests__/use-pipeline.test.ts` (new)

Test cases (mock fetch, mock pipelineStore):
- startPipeline: calls correct endpoint with API key header
- startPipeline without API key: sets actionError
- cancelPipeline: calls correct endpoint
- retryPipeline: calls correct endpoint
- Loading states toggle correctly
- Error handling from API responses

- [ ] **18.13** Create tests for PipelineControls component

**File**: `src/components/pipeline/__tests__/pipeline-controls.test.tsx` (new)

Test cases (mock usePipeline hook):
- Renders "Start Pipeline" when no pipeline exists
- Renders "Cancel Pipeline" when running
- Renders "Retry" and "Cancel" when paused
- Renders "Approve" and "Request Changes" when completed (passed)
- Renders "Start Pipeline" when failed or cancelled
- Loading spinners appear during API calls
- Confirmation dialog for destructive actions
- All `data-testid` attributes present

- [ ] **18.14** Create tests for ErrorNotification component

**File**: `src/components/pipeline/__tests__/error-notification.test.tsx` (new)

Test cases (mock usePipeline hook, mock pipelineStore):
- Banner renders when paused with errorDetails
- Banner does not render when running or completed
- Displays error message, agent, phase, retry count
- Retry button triggers retryPipeline
- Cancel button triggers cancelPipeline
- Dismiss button hides banner
- All `data-testid` attributes present

**Stories**: All (US-025 -- US-032)
**Testing Framework**: Vitest + React Testing Library (from UOW-01 setup)

---

### Step 19: Documentation Summary

- [ ] **19.1** Create `src/lib/services/sse-service.ts` inline code comment documenting Redis pub/sub scaling path

Add a block comment at the top of SSEService:
```typescript
/**
 * SSEService -- In-memory SSE connection registry.
 *
 * Current: Single-process Map<taskId, Set<Writer>>. Suitable for MVP.
 *
 * Scaling path (multi-process/multi-server):
 *   1. Replace Map with Redis pub/sub
 *   2. Each server process subscribes to Redis channel per taskId
 *   3. PipelineOrchestrator publishes events to Redis instead of direct push
 *   4. SSEService subscribes and forwards to local connections
 *   5. No change to client-side code (SSE endpoint stays the same)
 */
```

- [ ] **19.2** Verify all files include JSDoc/TSDoc comments for exported functions and interfaces

Ensure every exported function has:
- Brief description
- `@param` tags with types and descriptions
- `@returns` tag with type and description
- `@throws` tag for functions that throw

- [ ] **19.3** Verify story traceability coverage

Final cross-check matrix:

| Story | Files Implementing |
|-------|--------------------|
| US-025 | start-pipeline/route.ts, pipeline-orchestrator.ts, pipeline-store.ts, use-pipeline.ts, pipeline-controls.tsx |
| US-026 | planner-agent.ts, planner-prompt.ts, pipeline-orchestrator.ts (planning phase) |
| US-027 | coder-agent.ts, coder-prompt.ts, pipeline-orchestrator.ts (coding phase) |
| US-028 | reviewer-agent.ts, reviewer-prompt.ts, pipeline-orchestrator.ts (reviewing phase) |
| US-029 | pipeline-orchestrator.ts (fixing phase, auto-fix loop), coder-agent.ts (fix mode) |
| US-030 | pipeline-orchestrator.ts (completion branch), approve/route.ts |
| US-031 | pipeline-orchestrator.ts (failure branch, max iterations) |
| US-032 | cancel/route.ts, pipeline-orchestrator.ts (cancel method), pipeline-controls.tsx |

---

## Business Rules Cross-Reference

| Rule | Enforcement Point | Step |
|------|-------------------|------|
| BR-04-001 | start-pipeline route handler | Step 11.1 |
| BR-04-002 | start-pipeline route handler + DB query | Step 11.1 |
| BR-04-003 | PipelineOrchestrator state machine (iteration check) | Step 10.1 |
| BR-04-004 | start-pipeline route handler (header check) | Step 11.1 |
| BR-04-005 | PlannerAgent Zod validation | Steps 3.1, 6.1 |
| BR-04-006 | CoderAgent Zod validation | Steps 3.1, 7.1 |
| BR-04-007 | ReviewerAgent Zod validation | Steps 3.1, 8.1 |
| BR-04-008 | PipelineOrchestrator (start -> task "spec") | Step 10.1 |
| BR-04-009 | PipelineOrchestrator (coding -> task "building") | Step 10.1 |
| BR-04-010 | PipelineOrchestrator (review pass -> task "review") | Step 10.1 |
| BR-04-011 | PipelineOrchestrator (fixing -> task stays "building") | Step 10.1 |
| BR-04-012 | PipelineOrchestrator (failure -> task "backlog") | Step 10.1 |
| BR-04-013 | approve route handler (task -> "done") | Step 11.5 |
| BR-04-014 | cancel route handler (any active phase) | Step 11.4 |
| BR-04-015 | SSE route handler (10-min timeout) | Step 12.1 |
| BR-04-016 | AGENT_CONFIGS constant (token limits) | Step 2.2 |
| BR-04-017 | PipelineOrchestrator retry handler (exponential backoff) | Steps 5.2, 10.1 |

---

## NFR Cross-Reference

| NFR | Enforcement Point | Step |
|-----|-------------------|------|
| NFR-04-001 | Agent streaming -> SSE push (< 500ms latency) | Steps 5.1, 6.1, 7.1, 8.1 |
| NFR-04-002 | start-pipeline returns 202 immediately; orchestrator runs async | Steps 10.1, 11.1 |
| NFR-04-003 | All agent calls use async/await, no event loop blocking | Step 10.1 |
| NFR-04-004 | SSE route keepalive interval (30s) | Step 12.1 |
| NFR-04-005 | API key from header, never stored | Steps 5.1, 11.1 |
| NFR-04-006 | API key format validation (sk-ant-*) | Steps 3.1, 11.1 |
| NFR-04-007 | sanitizeAgentOutput() in agent-base.ts | Step 5.1 |
| NFR-04-008 | All routes enforce ownership, return 404 for unauthorized | Steps 11.1-11.6, 12.1 |
| NFR-04-009 | Pipeline start rate limiting (max 5 concurrent per user) | Step 11.1 |
| NFR-04-010 | DB write at every phase transition | Step 10.1 |
| NFR-04-011 | useSSE auto-reconnect (3 attempts, 1s/2s/4s backoff) | Step 14.1 |
| NFR-04-012 | PipelineOrchestrator catches RateLimitError, pauses with retry | Step 10.1 |
| NFR-04-013 | 10-minute AbortController timeout on orchestrator | Steps 10.1, 12.1 |
| NFR-04-014 | withRetry utility (1s, 2s, 4s delays) | Step 5.2 |
| NFR-04-015 | SSEService uses in-memory Map (Redis path documented) | Steps 9.1, 19.1 |
| NFR-04-016 | One active pipeline per task (DB check) | Steps 10.1, 11.1 |
| NFR-04-017 | Prompts in separate /lib/prompts/ files | Step 4 |
| NFR-04-018 | Structured logging with taskId/pipelineId in all services | Steps 5.1, 6.1, 7.1, 8.1, 10.1 |

---

## data-testid Attribute Summary

| Component | Element | data-testid |
|-----------|---------|-------------|
| PipelineControls | Wrapper | `pipeline-controls` |
| PipelineControls | Start Pipeline button | `btn-start-pipeline` |
| PipelineControls | Cancel Pipeline button | `btn-cancel-pipeline` |
| PipelineControls | Retry button | `btn-retry-pipeline` |
| PipelineControls | Approve button | `btn-approve-pipeline` |
| PipelineControls | Request Changes button | `btn-request-changes` |
| ErrorNotification | Wrapper | `error-notification` |
| ErrorNotification | Retry button | `btn-error-retry` |
| ErrorNotification | Cancel button | `btn-error-cancel` |
| ErrorNotification | Dismiss button | `btn-error-dismiss` |

---

## Dependency Graph (Implementation Order)

```
Step 1:  Prisma Schema ──────────────────────────────────────────────────────┐
Step 2:  Type Definitions ───────────────────────────────────────────────────┤
Step 3:  Zod Schemas ───────────────── depends on Step 2 (types)            │
Step 4:  Prompt Files ───────────────── depends on Step 2 (types)            │
Step 5:  Agent Base + Retry Util ────── depends on Steps 2, 3               │
Step 6:  PlannerAgent ───────────────── depends on Steps 3, 4, 5            │
Step 7:  CoderAgent ─────────────────── depends on Steps 3, 4, 5            │
Step 8:  ReviewerAgent ──────────────── depends on Steps 3, 4, 5            │
Step 9:  SSEService ─────────────────── depends on Step 2 (SSE types)       │
Step 10: PipelineOrchestrator ───────── depends on Steps 1, 6, 7, 8, 9     │
Step 11: Pipeline API Routes ────────── depends on Steps 1, 3, 10           │
Step 12: SSE API Route ─────────────── depends on Step 9                    │
Step 13: Pipeline Store ─────────────── depends on Step 2                   │
Step 14: useSSE Hook ────────────────── depends on Steps 2, 13             │
Step 15: usePipeline Hook ──────────── depends on Steps 2, 13             │
Step 16: PipelineControls ──────────── depends on Steps 14, 15             │
Step 17: ErrorNotification ─────────── depends on Steps 13, 15             │
Step 18: Unit Tests ─────────────────── depends on all above               │
Step 19: Documentation ──────────────── depends on all above               │
```

**Parallelizable groups**:
- Steps 2, 3, 4 can proceed in parallel once Step 1 is done
- Steps 6, 7, 8 can proceed in parallel once Step 5 is done
- Steps 9, 13 can proceed in parallel (independent)
- Steps 11, 12 can proceed in parallel once Step 10/9 are done
- Steps 14, 15 can proceed in parallel once Step 13 is done
- Steps 16, 17 can proceed in parallel once Steps 14, 15 are done

---

## Total File Count

| Category | Files | New/Edit |
|----------|-------|----------|
| Prisma Schema | 1 | Edit |
| Type Definitions | 3 | New |
| Validation Schemas | 1 | New |
| Prompt Files | 3 | New |
| Agent Services | 4 | New |
| Core Services | 2 | New |
| Utility | 1 | New |
| API Routes | 7 | New |
| Zustand Store | 1 | New |
| Hooks | 2 | New |
| Components | 2 | New |
| Test Files | 14+ | New |
| **Total** | **41+** | 40 new, 1 edit |
