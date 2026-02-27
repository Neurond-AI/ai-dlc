# Business Rules -- UOW-04: AI Pipeline Engine

## Overview

All business rules for UOW-04 are listed below with unique IDs (BR-04-XXX), rule statement, validation logic, and error messages. Rules are grouped by domain: Pipeline Lifecycle, Agent Output, Task Status Transitions, SSE & Connectivity, Error Handling & Retry.

---

## Pipeline Lifecycle Rules

### BR-04-001: Pipeline Start Precondition

| Field | Value |
|-------|-------|
| **Rule** | Pipeline can only start on tasks in Backlog or Spec status |
| **Validation** | API route checks `task.status` against allowed values `["backlog", "spec"]` before creating PipelineRun. |
| **Error Message** | "Pipeline can only start on tasks in Backlog or Spec status" |
| **Enforcement** | Server-side (POST /api/tasks/[id]/start-pipeline route handler) |
| **Stories** | US-025 |

### BR-04-002: One Active Pipeline Per Task

| Field | Value |
|-------|-------|
| **Rule** | Only one active pipeline run per task at a time |
| **Validation** | Before creating PipelineRun, query for existing runs where `taskId = task.id AND status IN ("running", "paused")`. If found, reject. |
| **Error Message** | "A pipeline is already running for this task" |
| **Enforcement** | Server-side (start-pipeline route, DB query) |
| **Stories** | US-025 |

### BR-04-003: Maximum Review Iterations

| Field | Value |
|-------|-------|
| **Rule** | Maximum 3 review iterations per pipeline run (initial + 2 auto-fixes) |
| **Validation** | PipelineOrchestrator checks `pipelineRun.iteration < 3` before entering FIXING phase. Iteration count: 0 = initial run, 1 = first fix, 2 = second fix. If iteration >= 2 after review failure, pipeline transitions to FAILED. |
| **Error Message** | N/A (internal state machine rule). User sees: "Pipeline failed after 3 review attempts." |
| **Enforcement** | Server-side (PipelineOrchestrator state machine) |
| **Stories** | US-029, US-031 |

### BR-04-004: API Key Required in Request Header

| Field | Value |
|-------|-------|
| **Rule** | API key must be provided in request header (`x-anthropic-key`); never stored server-side |
| **Validation** | API route reads `request.headers.get("x-anthropic-key")`. If empty or missing, return 401. Key passed to agent calls via function parameter. Key NEVER written to database, logs, or any persistent store. Exists in server memory only during request/pipeline execution. |
| **Error Message** | "API key required. Provide x-anthropic-key header." |
| **Enforcement** | Server-side (start-pipeline route header check) |
| **Stories** | US-006, US-025 |

### BR-04-014: Pipeline Cancel Allowed at Any Active Phase

| Field | Value |
|-------|-------|
| **Rule** | Pipeline cancellation is allowed at any active phase (PLANNING, CODING, REVIEWING, FIXING, PAUSED) |
| **Validation** | Cancel route checks `pipelineRun.status IN ("running", "paused")`. On cancel: abort current agent call via AbortController, update PipelineRun to CANCELLED, update Task to "backlog". |
| **Error Message** | "No active pipeline to cancel" (if status is already completed/failed/cancelled) |
| **Enforcement** | Server-side (POST /api/pipeline/[taskId]/cancel route) |
| **Stories** | US-032 |

---

## Agent Output Rules

### BR-04-005: Planner Output Schema Conformance

| Field | Value |
|-------|-------|
| **Rule** | Planner agent output must conform to SubtaskList JSON schema |
| **Validation** | After streaming completes, accumulated text is parsed as JSON and validated against Zod schema: `{ subtasks: z.array(z.object({ id: z.string(), title: z.string(), description: z.string(), order: z.number() })).min(1).max(10) }`. On failure: retry once with explicit JSON instruction, then pause pipeline. |
| **Error Message** | N/A (internal). Log: "Planner output failed schema validation" |
| **Enforcement** | Server-side (PlannerAgent response parser) |
| **Stories** | US-026 |

### BR-04-006: Coder Output Schema Conformance

| Field | Value |
|-------|-------|
| **Rule** | Coder agent output must conform to FileChanges JSON schema |
| **Validation** | Validated against Zod schema: `{ files: z.array(z.object({ filePath: z.string(), language: z.string(), content: z.string(), action: z.enum(["create", "modify", "delete"]) })) }`. On failure: retry once, then pause pipeline. |
| **Error Message** | N/A (internal). Log: "Coder output failed schema validation" |
| **Enforcement** | Server-side (CoderAgent response parser) |
| **Stories** | US-027 |

### BR-04-007: Reviewer Output Schema Conformance

| Field | Value |
|-------|-------|
| **Rule** | Reviewer agent output must conform to ReviewResult JSON schema |
| **Validation** | Validated against Zod schema: `{ passed: z.boolean(), score: z.number().min(0).max(100), findings: z.array(z.object({ severity: z.enum(["error", "warning", "info"]), file: z.string(), line: z.number(), message: z.string() })) }`. On failure: retry once, then pause pipeline. |
| **Error Message** | N/A (internal). Log: "Reviewer output failed schema validation" |
| **Enforcement** | Server-side (ReviewerAgent response parser) |
| **Stories** | US-028 |

---

## Task Status Transition Rules

### BR-04-008: Pipeline Start Moves Task to Spec

| Field | Value |
|-------|-------|
| **Rule** | On pipeline start, task moves from current status to "spec" |
| **Validation** | PipelineOrchestrator calls `taskService.updateStatus(taskId, "spec")` after creating PipelineRun. SSE event `task-status` pushed to notify client. Only applies if task is currently in "backlog"; if already "spec", no-op. |
| **Error Message** | N/A (automatic transition) |
| **Enforcement** | Server-side (PipelineOrchestrator, step 1) |
| **Stories** | US-025 |

### BR-04-009: Coding Phase Sets Task to Building

| Field | Value |
|-------|-------|
| **Rule** | When pipeline enters CODING phase, task status changes to "building" |
| **Validation** | PipelineOrchestrator calls `taskService.updateStatus(taskId, "building")` on PLANNING -> CODING transition. Pushed via SSE `task-status` event. |
| **Error Message** | N/A (automatic transition) |
| **Enforcement** | Server-side (PipelineOrchestrator, step 4) |
| **Stories** | US-019, US-027 |

### BR-04-010: Review Pass Moves Task to Review Column

| Field | Value |
|-------|-------|
| **Rule** | On successful review (passed = true), task moves to "review" status for human approval |
| **Validation** | PipelineOrchestrator calls `taskService.updateStatus(taskId, "review")` when ReviewerAgent returns `passed: true`. Pushed via SSE `task-status` and `pipeline-complete` events. |
| **Error Message** | N/A (automatic transition) |
| **Enforcement** | Server-side (PipelineOrchestrator, completion branch) |
| **Stories** | US-030 |

### BR-04-011: Auto-Fix Keeps Task in Building

| Field | Value |
|-------|-------|
| **Rule** | During auto-fix (review fail + retry), task stays in "building" status |
| **Validation** | No status change call when transitioning from REVIEWING -> FIXING. Task remains in "building". |
| **Error Message** | N/A (no-op) |
| **Enforcement** | Server-side (PipelineOrchestrator, fix branch) |
| **Stories** | US-029 |

### BR-04-012: Pipeline Failure Moves Task to Backlog

| Field | Value |
|-------|-------|
| **Rule** | On pipeline failure (max retries exhausted), task moves back to "backlog" with error state |
| **Validation** | PipelineOrchestrator calls `taskService.updateStatus(taskId, "backlog")` and stores error details on PipelineRun. Pushed via SSE `task-status` and `pipeline-complete(failed)` events. |
| **Error Message** | N/A (automatic transition). User sees task card with red error indicator. |
| **Enforcement** | Server-side (PipelineOrchestrator, failure branch) |
| **Stories** | US-031 |

### BR-04-013: Human Approve Moves Task to Done

| Field | Value |
|-------|-------|
| **Rule** | On human approval (via approve endpoint), task moves to "done" status |
| **Validation** | POST /api/pipeline/[taskId]/approve checks task is in "review" status, then calls `taskService.updateStatus(taskId, "done")`. Pushed via SSE `task-status` event. |
| **Error Message** | "Task must be in Review status to approve" (if precondition fails) |
| **Enforcement** | Server-side (approve route handler) |
| **Stories** | US-045 (UOW-06 frontend, UOW-04 backend route) |

---

## SSE & Connectivity Rules

### BR-04-015: SSE Connection Timeout

| Field | Value |
|-------|-------|
| **Rule** | SSE connection timeout is 10 minutes (maximum pipeline duration) |
| **Validation** | Server sets a `setTimeout` on SSE connection open. After 600,000ms, a timeout event is pushed and the stream is closed. Client receives `{ type: "timeout" }` and can reconnect if pipeline is still active. Keepalive pings (every 30s) prevent premature proxy/LB disconnects. |
| **Error Message** | SSE event: `{ type: "timeout", message: "Connection timed out. Reconnect if pipeline is still running." }` |
| **Enforcement** | Server-side (GET /api/sse/[taskId] route handler) |
| **Stories** | US-025, US-026, US-027, US-028 |

### BR-04-016: Agent Token Limits

| Field | Value |
|-------|-------|
| **Rule** | Each agent has a defined max_tokens limit for Anthropic API calls |
| **Validation** | Agent wrappers set `max_tokens` parameter in Anthropic SDK call. Planner: 4096, Coder: 8192, Reviewer: 4096. Values defined as constants in agent config. |
| **Error Message** | N/A (SDK parameter). If output is truncated, the JSON parse will fail and trigger retry. |
| **Enforcement** | Server-side (agent wrapper configuration) |
| **Stories** | US-026, US-027, US-028 |

---

## Error Handling & Retry Rules

### BR-04-017: Exponential Backoff Delays

| Field | Value |
|-------|-------|
| **Rule** | Retry delays follow exponential backoff: 1000ms, 2000ms, 4000ms |
| **Validation** | On user-approved retry, PipelineOrchestrator calculates delay as `1000 * Math.pow(2, retryCount)` where retryCount is 0-indexed (0 -> 1000ms, 1 -> 2000ms, 2 -> 4000ms). A countdown is pushed via SSE agent-log before the actual retry. |
| **Error Message** | SSE agent-log: "Retrying in Xs..." |
| **Enforcement** | Server-side (PipelineOrchestrator retry handler) |
| **Stories** | US-050 |

---

## Rules Summary Matrix

| Rule ID | Domain | Type | Enforcement |
|---------|--------|------|------------|
| BR-04-001 | Pipeline Lifecycle | Precondition | Server |
| BR-04-002 | Pipeline Lifecycle | Concurrency guard | Server (DB query) |
| BR-04-003 | Pipeline Lifecycle | Iteration limit | Server (state machine) |
| BR-04-004 | Pipeline Lifecycle | Security / auth | Server (header check) |
| BR-04-005 | Agent Output | Schema validation | Server (Zod) |
| BR-04-006 | Agent Output | Schema validation | Server (Zod) |
| BR-04-007 | Agent Output | Schema validation | Server (Zod) |
| BR-04-008 | Task Status | Auto-transition | Server (orchestrator) |
| BR-04-009 | Task Status | Auto-transition | Server (orchestrator) |
| BR-04-010 | Task Status | Auto-transition | Server (orchestrator) |
| BR-04-011 | Task Status | No-op guard | Server (orchestrator) |
| BR-04-012 | Task Status | Auto-transition | Server (orchestrator) |
| BR-04-013 | Task Status | Manual transition | Server (approve route) |
| BR-04-014 | Pipeline Lifecycle | Cancel guard | Server (cancel route) |
| BR-04-015 | SSE & Connectivity | Timeout policy | Server (SSE handler) |
| BR-04-016 | Agent Configuration | Token limits | Server (SDK config) |
| BR-04-017 | Error Handling | Retry timing | Server (orchestrator) |
