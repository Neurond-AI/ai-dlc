# Component Methods — AutoCoder

## Note

Method signatures and high-level purpose defined here. Detailed business rules, validation logic, error handling specifics, and edge cases will be specified in Functional Design (CONSTRUCTION phase).

---

## API Route Methods

### Auth API (`/api/auth/*`)

#### POST /api/auth/register

- **Signature**: `(req: { name: string; email: string; password: string }) => Response<{ user: User }>`
- **Purpose**: Create new user account with hashed password and default project.
- **Input**: `{ name: string; email: string; password: string }`
- **Output**: `201 { user: { id, name, email } }` | `400 { error: string }` | `409 { error: "Email already registered" }`

#### POST /api/auth/login

- **Signature**: `(req: { email: string; password: string }) => Response<{ user: User }>`
- **Purpose**: Authenticate user and set httpOnly session cookie.
- **Input**: `{ email: string; password: string }`
- **Output**: `200 { user: { id, name, email } }` | `401 { error: "Invalid email or password" }`

#### POST /api/auth/logout

- **Signature**: `(req: {}) => Response<{}>`
- **Purpose**: Invalidate session cookie and clear server-side session.
- **Input**: None (session cookie read from request)
- **Output**: `200 {}`

#### GET /api/auth/me

- **Signature**: `(req: {}) => Response<{ user: User | null }>`
- **Purpose**: Return currently authenticated user from session cookie.
- **Input**: None (session cookie read from request)
- **Output**: `200 { user: { id, name, email } }` | `401 { error: "Not authenticated" }`

---

### Project API (`/api/projects/*`)

#### GET /api/projects

- **Signature**: `(req: {}) => Response<{ projects: Project[] }>`
- **Purpose**: List all projects owned by the authenticated user.
- **Input**: None (user derived from session)
- **Output**: `200 { projects: Project[] }`

#### POST /api/projects

- **Signature**: `(req: { name: string }) => Response<{ project: Project }>`
- **Purpose**: Create a new project for the authenticated user.
- **Input**: `{ name: string }`
- **Output**: `201 { project: Project }` | `400 { error: string }`

#### PATCH /api/projects/[id]

- **Signature**: `(req: { name: string }, params: { id: string }) => Response<{ project: Project }>`
- **Purpose**: Rename an existing project (ownership verified).
- **Input**: `{ name: string }`
- **Output**: `200 { project: Project }` | `400 { error: string }` | `403` | `404`

#### DELETE /api/projects/[id]

- **Signature**: `(req: {}, params: { id: string }) => Response<{}>`
- **Purpose**: Delete project and cascade-delete all its tasks (ownership verified, last-project guard).
- **Input**: None (project ID from URL)
- **Output**: `200 {}` | `400 { error: "Cannot delete your only project" }` | `403` | `404`

---

### Task API (`/api/tasks/*`)

#### GET /api/tasks

- **Signature**: `(req: { searchParams: { projectId: string } }) => Response<{ tasks: Task[] }>`
- **Purpose**: List all tasks for a given project (ownership verified).
- **Input**: Query param `projectId`
- **Output**: `200 { tasks: Task[] }` | `400` | `403`

#### POST /api/tasks

- **Signature**: `(req: CreateTaskInput) => Response<{ task: Task }>`
- **Purpose**: Create a new task in Backlog status.
- **Input**: `{ projectId: string; title: string; description?: string; category: Category; priority: Priority }`
- **Output**: `201 { task: Task }` | `400 { error: string }`

#### PATCH /api/tasks/[id]

- **Signature**: `(req: Partial<TaskUpdate>, params: { id: string }) => Response<{ task: Task }>`
- **Purpose**: Update task fields (status, title, description, category, priority).
- **Input**: `Partial<{ status: ColumnStatus; title: string; description: string; category: Category; priority: Priority }>`
- **Output**: `200 { task: Task }` | `400` | `403` | `404`

#### DELETE /api/tasks/[id]

- **Signature**: `(req: {}, params: { id: string }) => Response<{}>`
- **Purpose**: Delete a task and its associated pipeline runs.
- **Input**: None (task ID from URL)
- **Output**: `200 {}` | `403` | `404`

#### POST /api/tasks/[id]/start-pipeline

- **Signature**: `(req: { apiKey: string }, params: { id: string }) => Response<{ pipelineRunId: string }>`
- **Purpose**: Validate API key and start the autonomous pipeline orchestrator for a task.
- **Input**: `{ apiKey: string }` (decrypted client-side, sent per-request)
- **Output**: `202 { pipelineRunId: string }` | `400 { error: "API key invalid" }` | `409 { error: "Pipeline already running" }`

---

### Pipeline API (`/api/pipeline/*`)

#### GET /api/pipeline/[taskId]/status

- **Signature**: `(req: {}, params: { taskId: string }) => Response<{ pipeline: PipelineStatus }>`
- **Purpose**: Get current pipeline execution state for a task.
- **Input**: None (taskId from URL)
- **Output**: `200 { pipeline: { phase, iteration, status, phaseTiming, subtasks, fileChanges } }` | `404`

#### POST /api/pipeline/[taskId]/retry

- **Signature**: `(req: { apiKey: string }, params: { taskId: string }) => Response<{ pipelineRunId: string }>`
- **Purpose**: Restart pipeline from Plan stage, discarding previous results.
- **Input**: `{ apiKey: string }`
- **Output**: `202 { pipelineRunId: string }` | `400` | `404`

#### POST /api/pipeline/[taskId]/cancel

- **Signature**: `(req: {}, params: { taskId: string }) => Response<{}>`
- **Purpose**: Abort a running pipeline and return task to Backlog.
- **Input**: None
- **Output**: `200 {}` | `400 { error: "No active pipeline" }` | `404`

#### POST /api/pipeline/[taskId]/approve

- **Signature**: `(req: {}, params: { taskId: string }) => Response<{ task: Task }>`
- **Purpose**: Approve reviewed code changes and move task to Done.
- **Input**: None
- **Output**: `200 { task: Task }` | `400 { error: "Task not in review status" }` | `404`

#### POST /api/pipeline/[taskId]/request-changes

- **Signature**: `(req: { feedback: string; apiKey: string }, params: { taskId: string }) => Response<{}>`
- **Purpose**: Send human feedback to Coder agent and restart code phase.
- **Input**: `{ feedback: string; apiKey: string }`
- **Output**: `202 {}` | `400` | `404`

---

### SSE API (`/api/sse/*`)

#### GET /api/sse/[taskId]

- **Signature**: `(req: {}, params: { taskId: string }) => ReadableStream (text/event-stream)`
- **Purpose**: Open SSE connection streaming agent logs and task state changes for a task.
- **Input**: None (taskId from URL, auth from session cookie)
- **Output**: SSE stream with event types:
  ```ts
  // Agent log chunk
  type LogEvent = { type: "log"; agent: AgentType; content: string; timestamp: string };
  // Task state change
  type StateEvent = { type: "state"; phase: PipelinePhase; status: ColumnStatus; iteration: number };
  // Error event
  type ErrorEvent = { type: "error"; message: string; retryable: boolean };
  // Pipeline complete
  type CompleteEvent = { type: "complete"; result: "passed" | "failed" };
  ```

---

## Agent Methods (`lib/agents/`)

### PlannerAgent.plan

- **Signature**: `(task: { title: string; description: string; category: string }) => AsyncGenerator<{ chunk: string }, SubtaskList>`
- **Purpose**: Analyze task description and produce an ordered list of implementation subtasks.
- **Input**: Task title, description, and category
- **Output**: Streams thinking chunks; resolves to `{ subtasks: { id: string; title: string; description: string; order: number }[] }`

### CoderAgent.code

- **Signature**: `(subtask: Subtask, context: { previousChanges: FileChange[]; reviewFeedback?: string }) => AsyncGenerator<{ chunk: string }, FileChanges>`
- **Purpose**: Generate file changes (path + content) for a single subtask.
- **Input**: Subtask definition + accumulated file changes from prior subtasks + optional review feedback
- **Output**: Streams thinking chunks; resolves to `{ files: { path: string; content: string; changeType: ChangeType }[] }`

### ReviewerAgent.review

- **Signature**: `(fileChanges: FileChange[], taskContext: { title: string; subtasks: Subtask[] }) => AsyncGenerator<{ chunk: string }, ReviewResult>`
- **Purpose**: Validate generated file changes for correctness, completeness, and quality.
- **Input**: All file changes + task context for completeness check
- **Output**: Streams thinking chunks; resolves to `{ verdict: "pass" | "fail"; findings: { severity: string; file: string; message: string }[] }`

---

## Pipeline Orchestrator (`lib/pipeline/orchestrator.ts`)

### PipelineOrchestrator.run

- **Signature**: `(taskId: string, apiKey: string, emitter: SSEEmitter) => Promise<PipelineResult>`
- **Purpose**: Execute the full Plan, Code, Review loop with auto-retry up to 3 iterations.
- **Input**: Task ID, decrypted API key, SSE emitter for streaming events
- **Output**: `{ status: "passed" | "failed"; iterations: number; fileChanges: FileChange[]; reviewFindings: ReviewFinding[] }`

### PipelineOrchestrator.cancel

- **Signature**: `(taskId: string) => void`
- **Purpose**: Signal cancellation to a running pipeline (sets abort flag).
- **Input**: Task ID
- **Output**: void (pipeline checks abort flag between stages)

---

## Store Methods (Zustand)

### authStore

#### login

- **Signature**: `(email: string, password: string) => Promise<void>`
- **Purpose**: Authenticate user via API and update store with user data.
- **Input**: Email and password strings
- **Output**: void (sets `user` state or `error`)

#### register

- **Signature**: `(name: string, email: string, password: string) => Promise<void>`
- **Purpose**: Create new account via API and update store with user data.
- **Input**: Name, email, and password strings
- **Output**: void (sets `user` state or `error`)

#### logout

- **Signature**: `() => Promise<void>`
- **Purpose**: Clear session via API and reset store to unauthenticated state.
- **Input**: None
- **Output**: void (sets `user` to null)

#### hydrate

- **Signature**: `() => Promise<void>`
- **Purpose**: Check existing session on app mount and populate user state.
- **Input**: None
- **Output**: void (sets `user` from GET /api/auth/me or null)

---

### projectStore

#### fetchProjects

- **Signature**: `() => Promise<void>`
- **Purpose**: Load all projects for authenticated user from API.
- **Input**: None
- **Output**: void (sets `projects` array)

#### createProject

- **Signature**: `(name: string) => Promise<Project>`
- **Purpose**: Create new project via API and add to store.
- **Input**: Project name
- **Output**: Created Project object

#### renameProject

- **Signature**: `(id: string, name: string) => Promise<void>`
- **Purpose**: Update project name via API and in store.
- **Input**: Project ID, new name
- **Output**: void

#### deleteProject

- **Signature**: `(id: string) => Promise<void>`
- **Purpose**: Delete project via API and remove from store; switch active project if needed.
- **Input**: Project ID
- **Output**: void

#### setActiveProject

- **Signature**: `(id: string) => void`
- **Purpose**: Set the active project (triggers task reload in taskStore).
- **Input**: Project ID
- **Output**: void (sets `activeProjectId`)

---

### taskStore

#### fetchTasks

- **Signature**: `(projectId: string) => Promise<void>`
- **Purpose**: Load all tasks for a project from API.
- **Input**: Project ID
- **Output**: void (sets `tasks` array)

#### createTask

- **Signature**: `(data: CreateTaskInput) => Promise<Task>`
- **Purpose**: Create task via API and add to store.
- **Input**: `{ projectId, title, description?, category, priority }`
- **Output**: Created Task object

#### updateTaskStatus

- **Signature**: `(id: string, status: ColumnStatus) => Promise<void>`
- **Purpose**: Update task column status (optimistic update for drag-and-drop, persisted to API).
- **Input**: Task ID, new status
- **Output**: void

#### updateTask

- **Signature**: `(id: string, data: Partial<Task>) => void`
- **Purpose**: Locally update task fields from SSE events (no API call — server already persisted).
- **Input**: Task ID, partial task data
- **Output**: void

#### deleteTask

- **Signature**: `(id: string) => Promise<void>`
- **Purpose**: Delete task via API and remove from store.
- **Input**: Task ID
- **Output**: void

#### startPipeline

- **Signature**: `(id: string) => Promise<void>`
- **Purpose**: Trigger pipeline start via API; pipelineStore handles SSE connection.
- **Input**: Task ID
- **Output**: void

---

### pipelineStore

#### connectSSE

- **Signature**: `(taskId: string) => void`
- **Purpose**: Open SSE connection for a task and wire incoming events to log/state updates.
- **Input**: Task ID
- **Output**: void (sets `sseConnection`, starts populating `agentLogs` and `activePipelines`)

#### disconnectSSE

- **Signature**: `() => void`
- **Purpose**: Close active SSE connection and clean up.
- **Input**: None
- **Output**: void (sets `sseConnection` to null)

#### retryPipeline

- **Signature**: `(taskId: string) => Promise<void>`
- **Purpose**: Restart pipeline from Plan stage via API.
- **Input**: Task ID
- **Output**: void (clears logs, resets pipeline state)

#### cancelPipeline

- **Signature**: `(taskId: string) => Promise<void>`
- **Purpose**: Abort running pipeline via API and disconnect SSE.
- **Input**: Task ID
- **Output**: void

#### approvePipeline

- **Signature**: `(taskId: string) => Promise<void>`
- **Purpose**: Approve reviewed code via API; task moves to Done.
- **Input**: Task ID
- **Output**: void

#### requestChanges

- **Signature**: `(taskId: string, feedback: string) => Promise<void>`
- **Purpose**: Send human feedback via API; pipeline restarts Coder phase.
- **Input**: Task ID, feedback text
- **Output**: void

---

### uiStore

#### toggleBottomDock

- **Signature**: `() => void`
- **Purpose**: Toggle agent log panel open/collapsed.
- **Input**: None
- **Output**: void (flips `isBottomDockOpen`)

#### openTaskModal / closeTaskModal

- **Signature**: `() => void`
- **Purpose**: Open or close the task creation modal.
- **Input**: None
- **Output**: void (sets `isTaskModalOpen`)

#### toggleSidebar

- **Signature**: `() => void`
- **Purpose**: Toggle sidebar collapsed/expanded.
- **Input**: None
- **Output**: void (flips `isSidebarCollapsed`)

#### setActiveLogTab

- **Signature**: `(tab: AgentType) => void`
- **Purpose**: Switch the active agent tab in the log panel.
- **Input**: Agent type ("planner" | "coder" | "reviewer")
- **Output**: void (sets `activeLogTab`)

#### selectTask

- **Signature**: `(taskId: string | null) => void`
- **Purpose**: Set or clear the selected task for detail view navigation.
- **Input**: Task ID or null
- **Output**: void (sets `selectedTaskId`)

---

## Shared Types Reference

```ts
type ColumnStatus = "backlog" | "spec" | "building" | "review" | "done";
type PipelinePhase = "spec" | "plan" | "code" | "review" | "done";
type AgentType = "planner" | "coder" | "reviewer";
type Category = "feature" | "bug-fix" | "refactoring" | "performance" | "security" | "ui-ux";
type Priority = "low" | "medium" | "high" | "critical";
type ChangeType = "added" | "modified" | "deleted";

interface Task {
  id: string;
  title: string;
  description: string;
  category: Category;
  priority: Priority;
  status: ColumnStatus;
  projectId: string;
  subtasks: Subtask[];
  pipelineState: PipelineRunState | null;
  fileChanges: FileChange[];
  createdAt: string;
  updatedAt: string;
}

interface Project {
  id: string;
  name: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

interface Subtask {
  id: string;
  title: string;
  description: string;
  order: number;
  completed: boolean;
}

interface FileChange {
  path: string;
  content: string;
  originalContent: string;
  changeType: ChangeType;
}

interface PipelineRunState {
  phase: PipelinePhase;
  status: "running" | "passed" | "failed" | "cancelled";
  iteration: number;
  phaseTiming: Record<PipelinePhase, number | null>;
}

interface ReviewFinding {
  severity: "error" | "warning" | "info";
  file: string;
  message: string;
}

interface LogEntryData {
  timestamp: string;
  content: string;
  agent: AgentType;
  isError: boolean;
}
```
