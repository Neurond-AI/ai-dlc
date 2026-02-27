# Business Logic Model -- UOW-04: AI Pipeline Engine

## Overview

This document defines the business processes for UOW-04, covering the server-side AI pipeline: agent wrappers (Planner, Coder, Reviewer), prompt templates, the PipelineOrchestrator state machine, SSE streaming, pipeline API routes, and the Zustand pipelineStore. All agent calls use the **Anthropic TypeScript SDK** with streaming enabled. Pipeline progress is pushed to the client via **Server-Sent Events (SSE)**. The PipelineOrchestrator runs asynchronously on the server -- it does NOT block the initial HTTP response.

---

## 1. Pipeline Start Flow

**Trigger**: POST /api/tasks/[id]/start-pipeline

```
Client (TaskDetailView or TaskCard "Start Pipeline" button)
  |
  [1] Retrieve API key from localStorage (decrypt)
  [2] Pre-flight check:
      - If no API key: block action, show "Configure API key in Settings"
      - If API key present: continue
  |
  [3] POST /api/tasks/[id]/start-pipeline
      Headers: { x-anthropic-key: <decrypted-key>, Cookie: <session> }
  |
Server (API Route)
  |
  [4] Authenticate user via session cookie (middleware)
  [5] Validate request:
      - Task exists (Prisma findUnique)
      - Task belongs to user (via project ownership chain: Task -> Project -> User)
      - Task status is "backlog" or "spec" (BR-04-001)
      - No active pipeline run for this task (BR-04-002)
      - x-anthropic-key header present and non-empty (BR-04-004)
  |
  [6] Create PipelineRun record in PostgreSQL:
      {
        taskId: task.id,
        phase: "planning",
        iteration: 0,
        status: "running",
        agentLogs: { planner: [], coder: [], reviewer: [] },
        fileChanges: { files: [] },
        reviewFindings: null,
        startedAt: now()
      }
  |
  [7] Update Task status to "spec" (BR-04-008)
  |
  [8] Return 202 Accepted with { runId: pipelineRun.id }
  |
  [9] Start PipelineOrchestrator.execute(pipelineRun.id, apiKey) -- ASYNC
      (Does not block the HTTP response)
```

**Error States**:

| Condition | Error Message | HTTP Status |
|-----------|--------------|-------------|
| Task not found | "Task not found" | 404 |
| Task not owned by user | "Task not found" | 404 |
| Task not in backlog/spec | "Pipeline can only start on tasks in Backlog or Spec status" | 400 |
| Active pipeline exists | "A pipeline is already running for this task" | 409 |
| Missing API key header | "API key required. Provide x-anthropic-key header." | 401 |
| Invalid task ID format | "Invalid task ID" | 400 |

---

## 2. PipelineOrchestrator State Machine

**Service**: `lib/services/pipeline-orchestrator.ts`

### State Diagram

```
IDLE --> PLANNING --> CODING --> REVIEWING
                                    |
                              pass? --> COMPLETED (task -> "review" column)
                              fail? --> iteration < 3? --> FIXING --> REVIEWING
                                        iteration >= 3? --> FAILED (task -> "backlog")
```

### External Interrupts

```
Any active phase:
  - User cancels --> CANCELLED (task -> "backlog")
  - API error --> PAUSED (wait for user action)
      - User retries --> resume from failed step (with exponential backoff)
      - User cancels --> CANCELLED (task -> "backlog")
      - Max 3 retries exhausted --> FAILED (task -> "backlog")
```

### Phase Execution Sequence

```
PipelineOrchestrator.execute(runId, apiKey):
  |
  [1] Load PipelineRun from DB
  [2] Set phase = PLANNING
      - Update PipelineRun.phase in DB
      - Push SSE: phase-change { phase: "planning", iteration: 0 }
  |
  [3] Call PlannerAgent.execute(task, apiKey)
      - Stream tokens -> SSE: agent-log { agent: "planner", chunk, timestamp }
      - Parse final output -> SubtaskList (Zod validation)
      - Store subtasks on Task record (Task.subtasks JSON field)
      - Store planner logs in PipelineRun.agentLogs.planner
  |
  [4] Set phase = CODING
      - Update Task status to "building" (BR-04-009)
      - Update PipelineRun.phase in DB
      - Push SSE: phase-change { phase: "coding", iteration: 0 }
      - Push SSE: task-status { taskId, newStatus: "building" }
  |
  [5] For each subtask in order:
      Call CoderAgent.execute(subtask, taskContext, previousOutputs, apiKey)
      - Stream tokens -> SSE: agent-log { agent: "coder", chunk, timestamp }
      - Parse final output -> FileChanges (Zod validation)
      - Accumulate file changes across all subtasks
      - Store in PipelineRun.fileChanges
  |
  [6] Set phase = REVIEWING
      - Update PipelineRun.phase in DB
      - Push SSE: phase-change { phase: "reviewing", iteration: 0 }
  |
  [7] Call ReviewerAgent.execute(allFileChanges, task, subtaskList, apiKey)
      - Stream tokens -> SSE: agent-log { agent: "reviewer", chunk, timestamp }
      - Parse final output -> ReviewResult (Zod validation)
      - Store in PipelineRun.reviewFindings
  |
  [8] Evaluate ReviewResult:
      - If passed:
          Set phase = COMPLETED, status = "passed"
          Update Task status to "review" (BR-04-010)
          Push SSE: task-status { taskId, newStatus: "review" }
          Push SSE: pipeline-complete { taskId, result: "passed" }
      - If failed AND iteration < 3:
          Increment PipelineRun.iteration
          Set phase = FIXING
          Push SSE: phase-change { phase: "fixing", iteration }
          -> Go to step [9] (Auto-Fix)
      - If failed AND iteration >= 3:
          Set phase = FAILED, status = "failed"
          Update Task status to "backlog" (BR-04-012)
          Push SSE: task-status { taskId, newStatus: "backlog" }
          Push SSE: pipeline-complete { taskId, result: "failed" }
```

### Phase Transition Side Effects

| Transition | DB Update | SSE Events | Task Status Change |
|------------|-----------|------------|-------------------|
| IDLE -> PLANNING | PipelineRun.phase = "planning" | phase-change | Task -> "spec" (BR-04-008) |
| PLANNING -> CODING | PipelineRun.phase = "coding" | phase-change, task-status | Task -> "building" (BR-04-009) |
| CODING -> REVIEWING | PipelineRun.phase = "reviewing" | phase-change | (no change) |
| REVIEWING -> COMPLETED | PipelineRun.phase = "completed", status = "passed" | pipeline-complete, task-status | Task -> "review" (BR-04-010) |
| REVIEWING -> FIXING | PipelineRun.phase = "fixing", iteration++ | phase-change | (stays "building", BR-04-011) |
| FIXING -> REVIEWING | PipelineRun.phase = "reviewing" | phase-change | (no change) |
| REVIEWING -> FAILED | PipelineRun.phase = "failed", status = "failed" | pipeline-complete, task-status | Task -> "backlog" (BR-04-012) |
| Any -> CANCELLED | PipelineRun.phase = "cancelled", status = "cancelled" | phase-change, task-status | Task -> "backlog" |
| Any -> PAUSED | PipelineRun.status = "paused" | error | (no change) |

---

## 3. Planner Agent

**Service**: `lib/agents/planner-agent.ts`
**Prompt**: `lib/prompts/planner-prompt.ts`

```
PlannerAgent.execute(task, apiKey):
  |
  [1] Build prompt:
      System: planner-prompt.ts system template
        - Role: "You are a senior software architect..."
        - Output format: JSON conforming to SubtaskList schema
        - Constraints: max 10 subtasks, each self-contained
      User: task.title + task.description + task.category
  |
  [2] Call Anthropic SDK:
      const stream = anthropic.messages.stream({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,            // BR-04-016
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });
  |
  [3] Stream processing:
      for await (const event of stream) {
        if (event.type === "content_block_delta") {
          const chunk = event.delta.text;
          sseService.push(taskId, {
            type: "agent-log",
            data: { agent: "planner", chunk, timestamp: Date.now() }
          });
          accumulator += chunk;
        }
      }
  |
  [4] Parse accumulated text:
      - Extract JSON from response (handle markdown code blocks)
      - Validate against SubtaskList Zod schema (BR-04-005)
      - If parse fails: throw PlannerOutputError (triggers retry)
  |
  [5] Return: SubtaskList
```

**Input/Output**:

| Field | Value |
|-------|-------|
| Input | task.title (string), task.description (string), task.category (string) |
| Output | `SubtaskList: { subtasks: [{ id: string, title: string, description: string, order: number }] }` |
| Max Tokens | 4096 (BR-04-016) |
| Model | claude-sonnet-4-20250514 (configurable) |

---

## 4. Coder Agent

**Service**: `lib/agents/coder-agent.ts`
**Prompt**: `lib/prompts/coder-prompt.ts`

```
CoderAgent.execute(subtask, taskContext, previousOutputs, apiKey, reviewFindings?):
  |
  [1] Build prompt:
      System: coder-prompt.ts system template
        - Role: "You are a senior full-stack developer..."
        - Output format: JSON conforming to FileChanges schema
        - Constraints: production-quality code, proper error handling
      User:
        - Current subtask: subtask.title + subtask.description
        - Full task context: task.title + task.description + task.category
        - Previous subtask outputs (accumulated file changes so far)
        - (If auto-fix): review findings from ReviewerAgent
  |
  [2] Call Anthropic SDK:
      const stream = anthropic.messages.stream({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,            // BR-04-016
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });
  |
  [3] Stream processing:
      for await (const event of stream) {
        if (event.type === "content_block_delta") {
          const chunk = event.delta.text;
          sseService.push(taskId, {
            type: "agent-log",
            data: { agent: "coder", chunk, timestamp: Date.now() }
          });
          accumulator += chunk;
        }
      }
  |
  [4] Parse accumulated text:
      - Extract JSON from response
      - Validate against FileChanges Zod schema (BR-04-006)
      - If parse fails: throw CoderOutputError (triggers retry)
  |
  [5] Return: FileChanges
```

**Input/Output**:

| Field | Value |
|-------|-------|
| Input | subtask (Subtask), taskContext (Task), previousOutputs (FileChanges), reviewFindings? (ReviewResult) |
| Output | `FileChanges: { files: [{ filePath: string, language: string, content: string, action: "create" \| "modify" \| "delete" }] }` |
| Max Tokens | 8192 (BR-04-016) |
| Model | claude-sonnet-4-20250514 (configurable) |

**Auto-Fix Mode**: When called from the FIXING phase, the `reviewFindings` parameter is included in the user prompt, providing the Reviewer's specific findings for the Coder to address.

---

## 5. Reviewer Agent

**Service**: `lib/agents/reviewer-agent.ts`
**Prompt**: `lib/prompts/reviewer-prompt.ts`

```
ReviewerAgent.execute(allFileChanges, task, subtaskList, apiKey):
  |
  [1] Build prompt:
      System: reviewer-prompt.ts system template
        - Role: "You are a senior code reviewer..."
        - Review criteria: correctness, completeness, code quality, security
        - Output format: JSON conforming to ReviewResult schema
        - Scoring: 0-100, pass threshold = 70
      User:
        - All file changes from Coder (full content)
        - Original task description
        - Subtask list from Planner
  |
  [2] Call Anthropic SDK:
      const stream = anthropic.messages.stream({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,            // BR-04-016
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });
  |
  [3] Stream processing:
      for await (const event of stream) {
        if (event.type === "content_block_delta") {
          const chunk = event.delta.text;
          sseService.push(taskId, {
            type: "agent-log",
            data: { agent: "reviewer", chunk, timestamp: Date.now() }
          });
          accumulator += chunk;
        }
      }
  |
  [4] Parse accumulated text:
      - Extract JSON from response
      - Validate against ReviewResult Zod schema (BR-04-007)
      - If parse fails: throw ReviewerOutputError (triggers retry)
  |
  [5] Return: ReviewResult
```

**Input/Output**:

| Field | Value |
|-------|-------|
| Input | allFileChanges (FileChanges), task (Task), subtaskList (SubtaskList) |
| Output | `ReviewResult: { passed: boolean, score: number, findings: [{ severity: string, file: string, line: number, message: string }] }` |
| Max Tokens | 4096 (BR-04-016) |
| Model | claude-sonnet-4-20250514 (configurable) |
| Pass Threshold | score >= 70 AND passed === true |

---

## 6. Auto-Fix Flow (on Review Failure)

**Trigger**: ReviewerAgent returns `passed: false` AND `PipelineRun.iteration < 3`

```
PipelineOrchestrator (FIXING phase):
  |
  [1] Increment PipelineRun.iteration
  [2] Push SSE: phase-change { phase: "fixing", iteration }
  [3] Push SSE: agent-log { agent: "coder", chunk: "Review failed -- auto-fixing (attempt X/3)", timestamp }
  |
  [4] Call CoderAgent.execute(
        subtask: null (full task scope),
        taskContext: task,
        previousOutputs: current fileChanges,
        apiKey,
        reviewFindings: reviewResult.findings   // <-- additional context
      )
      - Coder receives review findings as part of prompt
      - Generates new/updated file changes addressing findings
  |
  [5] Merge/replace file changes in PipelineRun.fileChanges
  [6] Set phase = REVIEWING
  [7] Push SSE: phase-change { phase: "reviewing", iteration }
  |
  [8] Call ReviewerAgent.execute(updatedFileChanges, task, subtaskList, apiKey)
  [9] Evaluate result -> loop back to step [8] of main sequence
```

**Iteration Counting**:
- iteration 0: initial plan -> code -> review
- iteration 1: first auto-fix -> review
- iteration 2: second auto-fix -> review
- If review still fails at iteration 2 (3rd review total): FAILED (BR-04-003)

---

## 7. Error Handling

### Anthropic API Failure

```
Agent call fails (network error, 429 rate limit, 500 server error):
  |
  [1] Catch error in PipelineOrchestrator
  [2] Update PipelineRun:
      - status = "paused"
      - errorDetails = { type, message, statusCode, failedAgent, failedPhase, timestamp }
  |
  [3] Push SSE: error {
        type: "api_error",
        message: "Anthropic API error: [status] [message]",
        retryable: true,
        retryCount: 0,
        maxRetries: 3,
        timestamp
      }
  |
  [4] Pipeline PAUSES -- awaits user action via API
```

### User-Approved Retry

```
User clicks "Retry" -> POST /api/pipeline/[taskId]/retry:
  |
  [1] Validate:
      - PipelineRun exists and status = "paused"
      - retryCount < 3
  |
  [2] Increment retryCount on error context
  [3] Calculate backoff delay:
      - Retry 1: 1000ms  (BR-04-017)
      - Retry 2: 2000ms
      - Retry 3: 4000ms
  |
  [4] Push SSE: agent-log { agent: failedAgent, chunk: "Retrying in Xs...", timestamp }
  |
  [5] Wait for backoff delay
  |
  [6] Update PipelineRun.status = "running"
  [7] Retry the failed agent call from the exact point of failure
  |
  [8] On success: resume normal pipeline flow
  [9] On failure: repeat from step [1] (up to 3 retries)
  [10] If all retries exhausted:
       - Set phase = FAILED, status = "failed"
       - Update Task status to "backlog" (BR-04-012)
       - Push SSE: pipeline-complete { taskId, result: "failed" }
```

### User Cancellation

```
User clicks "Cancel" -> POST /api/pipeline/[taskId]/cancel:
  |
  [1] Validate: PipelineRun exists and status is "running" or "paused"
  [2] Set abort signal on current agent call (AbortController)
  [3] Update PipelineRun:
      - phase = "cancelled"
      - status = "cancelled"
      - completedAt = now()
  [4] Update Task status to "backlog"
  [5] Push SSE: phase-change { phase: "cancelled" }
  [6] Push SSE: task-status { taskId, newStatus: "backlog" }
  [7] Return 200 OK
```

### Agent JSON Parse Error

```
Agent returns text that fails Zod validation:
  |
  [1] Log parse error details
  [2] Retry same agent call ONCE with appended instruction:
      "Your previous response was not valid JSON. Please respond with ONLY valid JSON matching the schema."
  [3] If retry also fails:
      - Treat as unrecoverable error
      - Push SSE: error { type: "parse_error", retryable: true }
      - Pipeline PAUSES (same flow as API failure)
```

---

## 8. SSE Service

**Service**: `lib/services/sse-service.ts`

### Connection Registry

```
SSEService (singleton):
  |
  connections: Map<string, Set<WritableStreamDefaultWriter>>
    key: taskId
    value: Set of active SSE writer connections
  |
  Methods:
    register(taskId, writer)    -- add connection to set
    unregister(taskId, writer)  -- remove connection from set
    push(taskId, event)         -- broadcast event to all connections for taskId
    closeAll(taskId)            -- close and remove all connections for taskId
```

### SSE Endpoint

```
GET /api/sse/[taskId]:
  |
  [1] Authenticate user via session cookie
  [2] Validate task exists and belongs to user
  [3] Create TransformStream
  [4] Register writer with SSEService for taskId
  |
  [5] Return Response with:
      - Content-Type: text/event-stream
      - Cache-Control: no-cache
      - Connection: keep-alive
      - X-Accel-Buffering: no (for nginx/proxies)
      - Body: readable side of TransformStream
  |
  [6] Start keepalive interval (30 seconds):
      Every 30s: write ": keepalive\n\n" to stream
  |
  [7] On client disconnect (stream closes):
      - Clear keepalive interval
      - Unregister writer from SSEService
      - Clean up resources
```

### Event Types

| Event Type | Data Shape | Producer | Consumer |
|------------|-----------|----------|----------|
| `agent-log` | `{ agent: "planner"\|"coder"\|"reviewer", chunk: string, timestamp: number }` | Agent wrappers during streaming | pipelineStore.appendLog |
| `phase-change` | `{ phase: PipelinePhase, status: PipelineStatus, iteration: number, timestamp: number }` | PipelineOrchestrator on transitions | pipelineStore.updatePhase |
| `task-status` | `{ taskId: string, newStatus: TaskStatus, timestamp: number }` | PipelineOrchestrator on column moves | taskStore.updateTaskStatus |
| `error` | `{ type: string, message: string, retryable: boolean, retryCount: number, maxRetries: number, timestamp: number }` | PipelineOrchestrator on failures | pipelineStore.setError |
| `pipeline-complete` | `{ taskId: string, result: "passed"\|"failed", fileChanges?: FileChanges, reviewFindings?: ReviewResult, timestamp: number }` | PipelineOrchestrator on completion | pipelineStore.setComplete |

### Wire Format

```
Each event pushed as:
  event: <event-type>\n
  data: <JSON string>\n
  \n

Example:
  event: agent-log
  data: {"agent":"planner","chunk":"Analyzing task...","timestamp":1709001234567}

  event: phase-change
  data: {"phase":"coding","status":"running","iteration":0,"timestamp":1709001234600}
```

### Connection Timeout

- SSE connection auto-closes after 10 minutes (BR-04-015)
- Server sets a timeout timer on connection open
- On timeout: push final event `{ type: "timeout", message: "Connection timed out" }`, then close stream
- Client can reconnect if pipeline is still running

---

## 9. Pipeline API Routes

### GET /api/pipeline/[taskId]/status

```
[1] Authenticate user via session
[2] Validate task belongs to user
[3] Fetch latest PipelineRun for taskId (ordered by startedAt DESC)
[4] Return 200 with:
    {
      runId, phase, iteration, status,
      agentLogs (summary: entry counts per agent),
      hasFileChanges: boolean,
      reviewScore: number | null,
      startedAt, completedAt,
      errorDetails
    }
[5] If no pipeline runs: return 200 with { status: "none" }
```

### POST /api/pipeline/[taskId]/retry

```
[1] Authenticate user via session
[2] Validate task belongs to user
[3] Validate PipelineRun exists and status = "paused"
[4] Validate retry count < 3
[5] Resume PipelineOrchestrator with exponential backoff
[6] Return 202 Accepted
```

### POST /api/pipeline/[taskId]/cancel

```
[1] Authenticate user via session
[2] Validate task belongs to user
[3] Validate PipelineRun exists and status is "running" or "paused"
[4] Trigger cancellation (abort agent call, update records)
[5] Return 200 OK with { status: "cancelled" }
```

### POST /api/pipeline/[taskId]/approve

```
[1] Authenticate user via session
[2] Validate task belongs to user
[3] Validate PipelineRun exists, status = "passed", task status = "review"
[4] Update Task status to "done" (BR-04-013)
[5] Push SSE: task-status { taskId, newStatus: "done" }
[6] Return 200 OK
```

### POST /api/pipeline/[taskId]/request-changes

```
[1] Authenticate user via session
[2] Validate task belongs to user
[3] Validate PipelineRun exists, status = "passed", task status = "review"
[4] Read feedback from request body: { feedback: string }
[5] Increment PipelineRun.iteration
[6] Update Task status to "building"
[7] Restart CoderAgent with human feedback as additional context
[8] Resume pipeline from CODING phase
[9] Return 202 Accepted
```

---

## 10. Zustand pipelineStore

**File**: `src/stores/pipeline-store.ts`

```
pipelineStore (Zustand):

State:
  pipelineRuns: Map<string, PipelineRunState>
    // key: taskId, value: {
    //   runId: string
    //   phase: PipelinePhase
    //   status: PipelineStatus
    //   iteration: number
    //   startedAt: number
    //   completedAt: number | null
    //   errorDetails: ErrorDetails | null
    //   fileChanges: FileChanges | null
    //   reviewFindings: ReviewResult | null
    // }

  agentLogs: Map<string, AgentLogsState>
    // key: taskId, value: {
    //   planner: LogEntry[]    // { chunk: string, timestamp: number }
    //   coder: LogEntry[]
    //   reviewer: LogEntry[]
    // }

Actions:
  startPipeline(taskId: string, runId: string):
    - Initialize pipelineRuns entry for taskId
    - Initialize empty agentLogs entry
    - POST to /api/tasks/[id]/start-pipeline

  updatePhase(taskId: string, phase: PipelinePhase, status: PipelineStatus, iteration: number):
    - Update pipelineRuns[taskId] with new phase/status/iteration
    - Called by useSSE hook on "phase-change" event

  appendLog(taskId: string, agent: AgentType, chunk: string, timestamp: number):
    - Append { chunk, timestamp } to agentLogs[taskId][agent]
    - Called by useSSE hook on "agent-log" event

  setError(taskId: string, errorDetails: ErrorDetails):
    - Update pipelineRuns[taskId].errorDetails
    - Update pipelineRuns[taskId].status = "paused"
    - Called by useSSE hook on "error" event

  setComplete(taskId: string, result: "passed" | "failed", fileChanges?: FileChanges, reviewFindings?: ReviewResult):
    - Update pipelineRuns[taskId].status based on result
    - Store fileChanges and reviewFindings if provided
    - Set completedAt = Date.now()
    - Called by useSSE hook on "pipeline-complete" event

  retryPipeline(taskId: string):
    - Clear errorDetails
    - POST to /api/pipeline/[taskId]/retry

  cancelPipeline(taskId: string):
    - POST to /api/pipeline/[taskId]/cancel
    - On success: update local state to cancelled

  clearLogs(taskId: string):
    - Reset agentLogs[taskId] to empty arrays

  getPipelineRun(taskId: string):
    - Selector: return pipelineRuns[taskId] or null
```

---

## Process-to-Story Traceability

| Business Process | Stories Covered |
|-----------------|----------------|
| Pipeline Start | US-025 |
| Planner Agent | US-026 |
| Coder Agent | US-027 |
| Reviewer Agent | US-028 |
| Auto-Fix Flow | US-029 |
| Pipeline Completion | US-030 |
| Pipeline Failure (max retries) | US-031 |
| Pipeline Cancellation | US-032 |
| Error Handling (API failures) | US-048, US-049, US-050, US-051 (partially -- UOW-04 backend, UOW-06 frontend UX) |

---

## Sequence Diagram: Full Pipeline Happy Path

```
Client          API Route       Orchestrator    PlannerAgent    CoderAgent    ReviewerAgent    SSE         DB
  |                 |                |               |              |              |            |           |
  |-- POST start -->|                |               |              |              |            |           |
  |                 |-- validate --->|               |              |              |            |           |
  |                 |                |-- create run -------------------------------------------------->|  |
  |                 |                |-- update task status("spec") ---------------------------------->|  |
  |<-- 202 ---------|                |               |              |              |            |           |
  |                 |                |               |              |              |            |           |
  |                 |                |-- execute ---->|              |              |            |           |
  |                 |                |               |-- stream ----|--------------|---------->  |           |
  |                 |                |               |-- result --->|              |            |           |
  |                 |                |-- update task(subtasks) ------------------------------------------->|
  |                 |                |               |              |              |            |           |
  |                 |                |-- update task status("building") -------------------------------->|  |
  |                 |                |-- for each subtask:          |              |            |           |
  |                 |                |               |-- execute -->|              |            |           |
  |                 |                |               |              |-- stream ----|---------->  |           |
  |                 |                |               |              |-- result --->|            |           |
  |                 |                |-- store fileChanges ------------------------------------------------>|
  |                 |                |               |              |              |            |           |
  |                 |                |-- execute ----|--------------|--->          |            |           |
  |                 |                |               |              |   -- stream--|---------->  |           |
  |                 |                |               |              |   -- result->|            |           |
  |                 |                |-- evaluate: passed                          |            |           |
  |                 |                |-- update task status("review") ---------------------------------->|  |
  |                 |                |-- push pipeline-complete ---------------------->         |           |
  |                 |                |               |              |              |            |           |
```
