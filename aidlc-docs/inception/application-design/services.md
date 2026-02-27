# Service Layer -- AutoCoder

## Service Architecture Overview

All services are server-side modules under `lib/`. API routes (`app/api/`) act as thin HTTP handlers that validate input (via ValidationService), call the appropriate service, and return responses. Services interact with PostgreSQL through Prisma and with the Anthropic API through the AgentService. No service calls another API route -- all inter-service communication is direct function invocation within the server process.

```
API Route (thin handler)
  -> ValidationService (Zod schema check)
  -> Domain Service (business logic)
    -> Prisma (database)
    -> AgentService (Anthropic SDK)
    -> SSEService (push to client)
```

---

## Core Services

### 1. AuthService (`lib/auth/`)

- **Purpose**: User authentication, session lifecycle, password management
- **Responsibilities**:
  - Register new user (validate uniqueness, hash password, create DB record, create default project)
  - Login (verify credentials, issue httpOnly session cookie)
  - Logout (invalidate session cookie)
  - Session validation middleware (check cookie on every protected request)
  - Password hashing (bcrypt, min 10 rounds)
- **Dependencies**: Prisma (User model), bcrypt, Next.js cookies API
- **Orchestration**: Stateless per-request. Each API call independently validates the session cookie. No long-running state.
- **Exposed to**: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, middleware for all protected routes
- **Error handling**: Generic "Invalid email or password" on auth failures (no credential enumeration). Rate limiting on login/register endpoints.

### 2. ProjectService (`lib/services/project-service.ts`)

- **Purpose**: Project CRUD and ownership enforcement
- **Responsibilities**:
  - Create project (name validation, ownership assignment to authenticated user)
  - List projects for authenticated user
  - Get single project (with ownership check)
  - Rename project (non-empty name validation)
  - Delete project (cascade delete all tasks and pipeline runs; prevent deleting last project)
  - Create default project on first registration (called by AuthService)
- **Dependencies**: Prisma (Project model), AuthService (for userId from session)
- **Orchestration**: Synchronous request-response. All operations are single Prisma transactions.
- **Exposed to**: `GET /api/projects`, `POST /api/projects`, `PATCH /api/projects/[id]`, `DELETE /api/projects/[id]`
- **Constraints**: User can only access own projects. Ownership enforced on every operation.

### 3. TaskService (`lib/services/task-service.ts`)

- **Purpose**: Task lifecycle management within a project
- **Responsibilities**:
  - Create task (title, description, category, priority; default status = backlog)
  - List tasks by project (filtered by status/category/search query)
  - Get single task (with project ownership check)
  - Update task fields (title, description, category, priority)
  - Update task status (column transitions: backlog -> spec -> building -> review -> done)
  - Delete task (cascade delete associated pipeline runs)
  - Update pipelineState JSON (current phase, iteration, timestamps)
  - Update subtasks JSON (from Planner agent output)
- **Dependencies**: Prisma (Task model), ProjectService (ownership validation)
- **Orchestration**: Synchronous request-response for CRUD. Status transitions triggered both manually (drag-and-drop) and programmatically (by PipelineOrchestrator).
- **Exposed to**: `GET /api/tasks`, `POST /api/tasks`, `PATCH /api/tasks/[id]`, `DELETE /api/tasks/[id]`, `PATCH /api/tasks/[id]/status`
- **Status transitions**: Validated -- only allowed transitions are enforced (e.g., cannot move directly from backlog to done without pipeline).

### 4. PipelineOrchestrator (`lib/services/pipeline-orchestrator.ts`) -- KEY SERVICE

- **Purpose**: Orchestrates the autonomous AI agent pipeline (plan -> code -> review -> auto-fix loop)
- **Responsibilities**:
  - Start a pipeline run for a given task
  - Create PipelineRun record in database
  - Execute phase sequence: Plan -> Code -> Review
  - Handle review failure: feed findings back to CoderAgent (auto-fix), increment iteration
  - Enforce max iteration limit (3 retries before marking failed)
  - Handle review pass: move task to Review column for human approval
  - Push all progress events to SSEService (phase transitions, agent logs, task status changes)
  - Handle API errors: pause pipeline, notify user, support retry with exponential backoff
  - Support cancellation: abort current agent call, clean up state
  - Support "Request Changes" flow: restart from Coder with human feedback
  - Support "Retry" flow: restart entire pipeline from Plan
- **Dependencies**: PlannerAgent, CoderAgent, ReviewerAgent, TaskService, SSEService, Prisma (PipelineRun model)
- **Orchestration**: Long-running server-side process. Invoked by API route (`POST /api/tasks/[id]/start-pipeline`), runs asynchronously on the server. Does NOT block the HTTP response -- returns immediately, pushes progress via SSE.
- **State Machine**:
  ```
  IDLE -> PLANNING -> CODING -> REVIEWING
                                    |
                          [fail, iter < 3] -> FIXING -> REVIEWING
                                    |
                          [fail, iter >= 3] -> FAILED
                                    |
                          [pass] -> COMPLETED
  ```
- **Concurrency**: Only one pipeline run per task at a time. Start request rejected if pipeline already active.
- **Persistence**: PipelineRun record updated at each phase transition. On server restart, interrupted runs are marked as failed (no automatic resumption in MVP).
- **Error strategy**: Anthropic API errors -> pause + SSE error event -> user approves retry -> exponential backoff (2s, 4s, 8s) -> max 3 retries per API call.

### 5. AgentService (`lib/agents/`)

- **Purpose**: Typed wrappers around the Anthropic TypeScript SDK for each agent persona
- **Sub-services**:
  - **PlannerAgent** (`lib/agents/planner-agent.ts`)
    - Input: task title + description (string)
    - Output: ordered subtask list (JSON array of `{ id, title, description, order }`)
    - Prompt template: `lib/prompts/planner-prompt.ts`
    - Streaming: yes (tokens forwarded to SSE as `agent-log` events)
  - **CoderAgent** (`lib/agents/coder-agent.ts`)
    - Input: subtask description + (optional) review findings for auto-fix
    - Output: file changes (JSON array of `{ filePath, content, action: 'create' | 'modify' | 'delete' }`)
    - Prompt template: `lib/prompts/coder-prompt.ts`
    - Streaming: yes
  - **ReviewerAgent** (`lib/agents/reviewer-agent.ts`)
    - Input: all file changes from Coder
    - Output: verdict (JSON `{ pass: boolean, findings: [{ file, line, severity, message }] }`)
    - Prompt template: `lib/prompts/reviewer-prompt.ts`
    - Streaming: yes
- **Dependencies**: Anthropic TypeScript SDK (`@anthropic-ai/sdk`), prompt templates (`lib/prompts/`)
- **Orchestration**: Each agent call is an async function that returns a ReadableStream for token streaming AND a Promise for the final parsed result. The PipelineOrchestrator consumes both.
- **API key handling**: Received per-request from the client (passed via secure API route header). Never stored server-side. Validated before first agent call.
- **Common pattern**:
  ```
  1. Build prompt from template + inputs
  2. Call Anthropic SDK with streaming enabled
  3. Forward each token chunk to SSEService
  4. Accumulate full response
  5. Parse structured JSON from response
  6. Return parsed result
  ```

### 6. SSEService (`lib/services/sse-service.ts`)

- **Purpose**: Server-Sent Events connection management and event dispatch
- **Responsibilities**:
  - Maintain a registry of active SSE connections keyed by taskId
  - Register new connection (on GET `/api/sse/[taskId]`)
  - Remove connection on client disconnect or timeout
  - Push typed events to all connections for a given task:
    - `agent-log`: streaming text chunks from agents (data: `{ agent, chunk, timestamp }`)
    - `phase-change`: pipeline phase transitions (data: `{ phase, status, iteration, timestamp }`)
    - `task-status`: task column/status changes (data: `{ taskId, newStatus, timestamp }`)
    - `error`: pipeline or API errors (data: `{ type, message, retryable, timestamp }`)
    - `pipeline-complete`: pipeline finished (data: `{ taskId, result: 'passed' | 'failed', timestamp }`)
  - Send keepalive pings every 30 seconds to prevent connection timeout
- **Dependencies**: None (pure Node.js `ReadableStream` / `TransformStream`)
- **Orchestration**: Event-driven. PipelineOrchestrator calls `sseService.push(taskId, event)`. SSEService writes to all registered streams for that taskId.
- **Connection lifecycle**:
  ```
  Client opens GET /api/sse/[taskId]
    -> SSEService registers stream
    -> Events pushed as they occur
    -> Client disconnects or server calls close()
    -> SSEService removes stream from registry
  ```
- **Single connection design**: One SSE connection per task carries ALL event types. Client-side `useSSE` hook demuxes events by type and dispatches to appropriate Zustand stores.

### 7. DiffService (`lib/services/diff-service.ts`)

- **Purpose**: Transform AI-produced file changes into displayable diff format
- **Responsibilities**:
  - Convert file changes JSON (`{ filePath, content, action }[]`) into unified diff format
  - Generate "before" (empty for new files) and "after" content pairs
  - Organize files into a tree structure for the file tree component
  - Calculate diff statistics (lines added, lines removed, files changed)
  - Detect file language from extension for syntax highlighting hints
- **Dependencies**: None (pure utility -- no database, no external APIs)
- **Orchestration**: Stateless. Called on-demand when Diff Review Panel renders. Input comes from PipelineRun.fileChanges stored in database.

### 8. ValidationService (`lib/services/validation-service.ts`)

- **Purpose**: Centralized input validation for all API endpoints
- **Responsibilities**:
  - Define and export Zod schemas for every API input:
    - `registerSchema`: email (valid format), password (min 8 chars)
    - `loginSchema`: email, password
    - `createProjectSchema`: name (non-empty, max 100 chars)
    - `createTaskSchema`: title (required, max 200 chars), description (optional), category (enum), priority (enum)
    - `updateTaskStatusSchema`: status (enum of valid columns)
    - `startPipelineSchema`: taskId (valid UUID)
  - Validate and return typed result or structured error
  - Sanitize string inputs (trim whitespace, strip dangerous characters)
- **Dependencies**: Zod
- **Orchestration**: Stateless. Called at the top of every API route handler before any business logic.
- **Pattern**:
  ```ts
  const result = validateSchema(createTaskSchema, req.body);
  if (!result.success) return NextResponse.json(result.errors, { status: 400 });
  // proceed with validated, typed data
  ```

---

## Service Interaction Map

```
Client (Browser)
  |
  |-- REST API calls (fetch) -------> API Routes (app/api/)
  |                                      |
  |                                      |-- AuthService
  |                                      |-- ProjectService
  |                                      |-- TaskService
  |                                      |-- PipelineOrchestrator (async start)
  |                                      |     |
  |                                      |     |-- PlannerAgent --> Anthropic API
  |                                      |     |-- CoderAgent  --> Anthropic API
  |                                      |     |-- ReviewerAgent -> Anthropic API
  |                                      |     |-- SSEService.push()
  |                                      |     |-- TaskService.updateStatus()
  |                                      |     '-- Prisma (PipelineRun)
  |                                      |
  |                                      '-- ValidationService (all routes)
  |
  |-- SSE connection (EventSource) --> GET /api/sse/[taskId]
  |                                      |
  |                                      '-- SSEService (stream events)
  |
  '-- localStorage (API key, UI prefs)
```

---

## Service-to-Database Mapping

| Service | Prisma Models Used | Operations |
|---------|-------------------|------------|
| AuthService | User | create, findUnique, update |
| ProjectService | Project | create, findMany, findUnique, update, delete |
| TaskService | Task | create, findMany, findUnique, update, delete |
| PipelineOrchestrator | PipelineRun, Task | create PipelineRun, update PipelineRun, update Task status |
| AgentService | (none directly) | N/A -- receives/returns data via PipelineOrchestrator |
| SSEService | (none) | N/A -- in-memory connection registry only |
| DiffService | (none) | N/A -- pure transformation |
| ValidationService | (none) | N/A -- pure validation |

---

## Error Handling Strategy

| Service | Error Type | Handling |
|---------|-----------|----------|
| AuthService | Invalid credentials | Return generic 401 (no enumeration) |
| AuthService | Duplicate email | Return 409 with safe message |
| ProjectService | Not found / not owned | Return 404 |
| ProjectService | Delete last project | Return 400 with explanation |
| TaskService | Not found / not owned | Return 404 |
| TaskService | Invalid status transition | Return 400 with allowed transitions |
| PipelineOrchestrator | Anthropic API 429/500 | Pause pipeline, SSE error event, await user retry |
| PipelineOrchestrator | Max retries exhausted | Mark task failed, SSE pipeline-complete(failed) |
| PipelineOrchestrator | Agent JSON parse error | Retry same agent call once, then fail |
| AgentService | Network timeout | Throw to PipelineOrchestrator for retry handling |
| SSEService | Client disconnect | Remove from registry, no error propagated |
| ValidationService | Invalid input | Return 400 with field-level Zod errors |
