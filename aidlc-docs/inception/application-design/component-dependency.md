# Component Dependencies -- AutoCoder

## Dependency Overview

AutoCoder follows a layered dependency architecture with strict boundaries:

1. **UI Components** depend on Zustand stores and hooks (never on API routes or services directly)
2. **Zustand stores** depend on API client functions (`lib/api/`) and SSE events
3. **API client functions** call REST endpoints via fetch
4. **API routes** call server-side services
5. **Services** call Prisma, Anthropic SDK, or other services

Data flows down through REST responses and sideways through SSE push events. Components never import server-side code. Stores act as the single boundary between client and server.

---

## Component Dependency Matrix

### Layout Components

| Component | Location | Depends On |
|-----------|----------|-----------|
| RootLayout | `app/layout.tsx` | AuthProvider, ThemeProvider, Toaster |
| AuthProvider | `components/providers/auth-provider.tsx` | authStore, useSession hook |
| AppShell | `components/layout/app-shell.tsx` | Sidebar, Header, BottomDock, uiStore |
| Header | `components/layout/header.tsx` | ProjectSwitcher, UserMenu, authStore, projectStore |
| Sidebar | `components/layout/sidebar.tsx` | NavLinks, projectStore, uiStore |
| BottomDock | `components/layout/bottom-dock.tsx` | AgentLogPanel, uiStore (collapsed state), pipelineStore (active indicator) |

### Kanban Components

| Component | Location | Depends On |
|-----------|----------|-----------|
| KanbanBoard | `components/kanban/kanban-board.tsx` | KanbanColumn (x5), taskStore, dnd-kit (DndContext, DragOverlay) |
| KanbanColumn | `components/kanban/kanban-column.tsx` | TaskCard (xN), dnd-kit (useDroppable), Framer Motion (AnimatePresence) |
| TaskCard | `components/kanban/task-card.tsx` | PhaseIndicator, PulseDot, CategoryBadge, SubtaskCount, pipelineStore, Framer Motion (layout animation) |
| PhaseIndicator | `components/kanban/phase-indicator.tsx` | pipelineStore (current phase) |
| PulseDot | `components/kanban/pulse-dot.tsx` | pipelineStore (isActive flag) |
| CategoryBadge | `components/ui/category-badge.tsx` | (none -- pure presentational) |
| SubtaskCount | `components/ui/subtask-count.tsx` | (none -- receives props) |
| EmptyState | `components/kanban/empty-state.tsx` | uiStore (open task modal) |
| BoardSkeleton | `components/kanban/board-skeleton.tsx` | shadcn/ui Skeleton |

### Task Components

| Component | Location | Depends On |
|-----------|----------|-----------|
| TaskCreationModal | `components/tasks/task-creation-modal.tsx` | taskStore, projectStore, Zod validation (createTaskSchema), shadcn/ui (Dialog, Input, Textarea, Select, Button) |
| TaskDetailView | `components/tasks/task-detail-view.tsx` | PipelineVisualization, AgentLogPanel, DiffReviewPanel, taskStore, pipelineStore |
| TaskCardMenu | `components/tasks/task-card-menu.tsx` | taskStore, pipelineStore (start/cancel pipeline), shadcn/ui DropdownMenu |

### Pipeline Components

| Component | Location | Depends On |
|-----------|----------|-----------|
| PipelineVisualization | `components/pipeline/pipeline-visualization.tsx` | PipelineNode (x5), PipelineConnector (x4), pipelineStore, Framer Motion |
| PipelineNode | `components/pipeline/pipeline-node.tsx` | pipelineStore (phase status), Framer Motion (pulse animation), Lucide icons |
| PipelineConnector | `components/pipeline/pipeline-connector.tsx` | pipelineStore (completion state), Framer Motion (line animation) |
| PhaseTimer | `components/pipeline/phase-timer.tsx` | pipelineStore (phase timestamps) |

### Agent Log Components

| Component | Location | Depends On |
|-----------|----------|-----------|
| AgentLogPanel | `components/agent-log/agent-log-panel.tsx` | AgentTab (x3), LogViewer, pipelineStore, uiStore (active tab) |
| AgentTab | `components/agent-log/agent-tab.tsx` | pipelineStore (hasNewContent indicator) |
| LogViewer | `components/agent-log/log-viewer.tsx` | pipelineStore (log entries), useAutoScroll hook, Framer Motion (typing effect) |
| LogEntry | `components/agent-log/log-entry.tsx` | (none -- pure presentational, receives timestamp + text + color) |

### Diff Review Components

| Component | Location | Depends On |
|-----------|----------|-----------|
| DiffReviewPanel | `components/diff-review/diff-review-panel.tsx` | FileTree, DiffViewer, ReviewActions, pipelineStore |
| FileTree | `components/diff-review/file-tree.tsx` | pipelineStore (fileChanges), Lucide icons |
| DiffViewer | `components/diff-review/diff-viewer.tsx` | DiffService output (unified diff), syntax highlighting |
| ReviewActions | `components/diff-review/review-actions.tsx` | taskStore (approve/reject/retry), pipelineStore |
| FeedbackInput | `components/diff-review/feedback-input.tsx` | shadcn/ui Textarea, Button |

### Settings Components

| Component | Location | Depends On |
|-----------|----------|-----------|
| SettingsPage | `app/(protected)/settings/page.tsx` | ApiKeySection, ProfileSection, authStore |
| ApiKeySection | `components/settings/api-key-section.tsx` | useApiKey hook (localStorage), validation API call |
| ProfileSection | `components/settings/profile-section.tsx` | authStore, Zod validation |

### Auth Pages

| Component | Location | Depends On |
|-----------|----------|-----------|
| LoginPage | `app/(auth)/login/page.tsx` | authStore (login action), Zod validation, shadcn/ui form components |
| RegisterPage | `app/(auth)/register/page.tsx` | authStore (register action), Zod validation, shadcn/ui form components |

---

## Data Flow Diagrams

### Pipeline Execution Flow (Primary Data Flow)

```
User clicks "Create & Start"
  |
  v
TaskCreationModal
  |-- validates form (Zod)
  |-- calls taskStore.createTask()
  |     |-- POST /api/tasks --> TaskService.create() --> Prisma insert
  |     '-- returns Task object
  |
  |-- calls taskStore.startPipeline(taskId)
        |-- POST /api/tasks/[id]/start-pipeline
        |     |-- ValidationService validates
        |     |-- PipelineOrchestrator.start(task, apiKey)
        |     |     |
        |     |     |-- Creates PipelineRun record (Prisma)
        |     |     |-- SSEService.push(taskId, { type: 'phase-change', phase: 'planning' })
        |     |     |
        |     |     |-- PlannerAgent.plan(task.description)
        |     |     |     |-- Anthropic SDK streaming call
        |     |     |     |-- Each token -> SSEService.push(taskId, { type: 'agent-log', agent: 'planner', chunk })
        |     |     |     '-- Returns subtasks JSON
        |     |     |
        |     |     |-- TaskService.updateSubtasks(taskId, subtasks)
        |     |     |-- SSEService.push(taskId, { type: 'phase-change', phase: 'coding' })
        |     |     |-- SSEService.push(taskId, { type: 'task-status', newStatus: 'building' })
        |     |     |
        |     |     |-- CoderAgent.code(subtasks)
        |     |     |     |-- Anthropic SDK streaming call
        |     |     |     |-- Each token -> SSEService.push(taskId, { type: 'agent-log', agent: 'coder', chunk })
        |     |     |     '-- Returns fileChanges JSON
        |     |     |
        |     |     |-- SSEService.push(taskId, { type: 'phase-change', phase: 'reviewing' })
        |     |     |
        |     |     |-- ReviewerAgent.review(fileChanges)
        |     |     |     |-- Anthropic SDK streaming call
        |     |     |     |-- Each token -> SSEService.push(taskId, { type: 'agent-log', agent: 'reviewer', chunk })
        |     |     |     '-- Returns { pass, findings } JSON
        |     |     |
        |     |     |-- IF pass:
        |     |     |     |-- Save fileChanges to PipelineRun
        |     |     |     |-- TaskService.updateStatus(taskId, 'review')
        |     |     |     |-- SSEService.push(taskId, { type: 'task-status', newStatus: 'review' })
        |     |     |     '-- SSEService.push(taskId, { type: 'pipeline-complete', result: 'passed' })
        |     |     |
        |     |     '-- IF fail AND iteration < 3:
        |     |           |-- SSEService.push(taskId, { type: 'phase-change', phase: 'fixing' })
        |     |           |-- CoderAgent.code(subtasks, findings)  // auto-fix
        |     |           '-- Loop back to ReviewerAgent
        |     |
        |     '-- Returns 202 Accepted (async processing)
        |
        '-- Client already listening via SSE
```

### SSE Event Flow (Real-Time Updates)

```
Server (PipelineOrchestrator)
  |
  |-- calls SSEService.push(taskId, event)
  |
  v
SSEService (in-memory registry)
  |
  |-- writes to all registered ReadableStreams for taskId
  |
  v
GET /api/sse/[taskId] (SSE endpoint, keeps connection open)
  |
  |-- Response stream (text/event-stream)
  |
  v
Client: EventSource / useSSE() hook
  |
  |-- Parses event.type
  |
  |-- 'agent-log'       -> pipelineStore.appendLog(agent, chunk)
  |                           -> AgentLogPanel re-renders (LogViewer)
  |
  |-- 'phase-change'    -> pipelineStore.setPhase(phase, status)
  |                           -> PipelineVisualization re-renders
  |                           -> TaskCard PhaseIndicator re-renders
  |
  |-- 'task-status'     -> taskStore.moveTask(taskId, newStatus)
  |                           -> KanbanBoard re-renders (card animates to new column)
  |
  |-- 'error'           -> pipelineStore.setError(error)
  |                           -> Toast notification shown
  |                           -> AgentLogPanel shows error entry
  |
  '-- 'pipeline-complete' -> pipelineStore.setComplete(result)
                               -> Toast notification
                               -> PulseDot stops
                               -> PhaseIndicator updates
```

### Auth Flow

```
Registration:
  RegisterPage (form submit)
    -> POST /api/auth/register
      -> ValidationService (registerSchema)
      -> AuthService.register(email, password)
        -> Check email uniqueness (Prisma)
        -> Hash password (bcrypt, 10 rounds)
        -> Create User record
        -> ProjectService.createDefault(userId) // "My First Project"
        -> Set httpOnly session cookie
      -> Redirect to /dashboard

Login:
  LoginPage (form submit)
    -> POST /api/auth/login
      -> ValidationService (loginSchema)
      -> AuthService.login(email, password)
        -> Find user by email (Prisma)
        -> Compare password hash (bcrypt)
        -> Set httpOnly session cookie
      -> Redirect to /dashboard

Session Check (every protected page):
  Next.js Middleware
    -> Read session cookie
    -> Validate session (AuthService.validateSession)
    -> If invalid: redirect to /login
    -> If valid: continue to page

Logout:
  UserMenu click "Logout"
    -> POST /api/auth/logout
      -> AuthService.logout()
        -> Clear session cookie
      -> Redirect to /login
```

### Drag-and-Drop Flow

```
User drags TaskCard
  -> dnd-kit DndContext onDragStart
    -> uiStore.setDragging(taskId)
    -> DragOverlay renders ghost card

User hovers over KanbanColumn
  -> dnd-kit onDragOver
    -> Visual placeholder shown in target column

User drops TaskCard
  -> dnd-kit onDragEnd
    -> taskStore.moveTask(taskId, newStatus)
      -> Optimistic UI update (immediate column move)
      -> PATCH /api/tasks/[id]/status { status: newStatus }
        -> TaskService.updateStatus()
        -> Prisma update
      -> On error: taskStore rollback to previous column + toast error
```

---

## Communication Patterns

| Path | Protocol | Direction | Purpose |
|------|----------|-----------|---------|
| Client -> API Routes | REST (fetch) | Request-Response | CRUD operations, pipeline start, auth |
| API Routes -> Client | SSE (EventSource) | Server Push | Agent logs, phase changes, task moves, errors |
| API Routes -> Anthropic | Anthropic SDK (HTTPS) | Streaming Request-Response | Agent LLM calls with token streaming |
| API Routes -> PostgreSQL | Prisma (TCP) | Request-Response | All data persistence |
| Client -> localStorage | Direct | Read/Write | API key storage, UI preferences |

### Why SSE over WebSockets

- Unidirectional server-to-client push is sufficient (client never pushes via the stream)
- Native browser `EventSource` API -- no library needed
- Automatic reconnection built into the protocol
- Simpler server implementation (no upgrade handshake, no ping/pong framing)
- Works through all proxies and CDNs without special configuration

---

## Store Dependencies

### authStore (`lib/stores/auth-store.ts`)

- **State**: user (id, email, name), isAuthenticated, isLoading
- **API endpoints**: POST /api/auth/register, POST /api/auth/login, POST /api/auth/logout, GET /api/auth/session
- **SSE events**: (none)
- **Consumed by**: AuthProvider, Header (UserMenu), SettingsPage, LoginPage, RegisterPage

### projectStore (`lib/stores/project-store.ts`)

- **State**: projects[], activeProjectId, isLoading
- **API endpoints**: GET /api/projects, POST /api/projects, PATCH /api/projects/[id], DELETE /api/projects/[id]
- **SSE events**: (none)
- **Consumed by**: Sidebar, Header (ProjectSwitcher), TaskCreationModal, KanbanBoard (filters by active project)

### taskStore (`lib/stores/task-store.ts`)

- **State**: tasks[] (for active project), isLoading
- **API endpoints**: GET /api/tasks?projectId=X, POST /api/tasks, PATCH /api/tasks/[id], DELETE /api/tasks/[id], PATCH /api/tasks/[id]/status
- **SSE events**: `task-status` (moveTask)
- **Consumed by**: KanbanBoard, KanbanColumn, TaskCard, TaskCreationModal, TaskDetailView, ReviewActions

### pipelineStore (`lib/stores/pipeline-store.ts`)

- **State**: activePipelines (Map<taskId, { phase, iteration, logs, fileChanges, error }>)
- **API endpoints**: POST /api/tasks/[id]/start-pipeline, POST /api/tasks/[id]/cancel-pipeline
- **SSE events**: `agent-log` (appendLog), `phase-change` (setPhase), `error` (setError), `pipeline-complete` (setComplete)
- **Consumed by**: TaskCard (PhaseIndicator, PulseDot), PipelineVisualization, AgentLogPanel, DiffReviewPanel, BottomDock (active indicator)

### uiStore (`lib/stores/ui-store.ts`)

- **State**: sidebarCollapsed, bottomDockCollapsed, activeLogTab, isDragging, taskModalOpen, searchQuery, categoryFilter
- **API endpoints**: (none -- local UI state only)
- **SSE events**: (none)
- **Consumed by**: AppShell, Sidebar, BottomDock, AgentLogPanel, KanbanBoard (search/filter), TaskCreationModal

---

## Store-to-SSE Event Mapping

```
SSE Event Type        -> Zustand Store       -> Store Action           -> Affected Components
--------------------- ---------------------- ------------------------ --------------------------------
agent-log             -> pipelineStore        -> appendLog()           -> LogViewer, AgentTab (indicator)
phase-change          -> pipelineStore        -> setPhase()            -> PipelineVisualization, TaskCard
task-status           -> taskStore            -> moveTask()            -> KanbanBoard (column animation)
error                 -> pipelineStore        -> setError()            -> Toast, AgentLogPanel
pipeline-complete     -> pipelineStore        -> setComplete()         -> Toast, TaskCard, PipelineViz
```

---

## Hooks

| Hook | Location | Purpose | Dependencies |
|------|----------|---------|-------------|
| useSSE | `lib/hooks/use-sse.ts` | Manages EventSource connection lifecycle, dispatches events to stores | pipelineStore, taskStore |
| useSession | `lib/hooks/use-session.ts` | Checks auth status on mount, redirects if unauthenticated | authStore |
| useApiKey | `lib/hooks/use-api-key.ts` | Read/write/validate API key from localStorage | (localStorage) |
| useAutoScroll | `lib/hooks/use-auto-scroll.ts` | Auto-scroll log panel, pause on manual scroll | (ref-based, no store) |
| useTaskFilters | `lib/hooks/use-task-filters.ts` | Filter/search tasks in KanbanBoard | uiStore, taskStore |

---

## External Dependency Map

| Package | Used By | Purpose |
|---------|---------|---------|
| `@anthropic-ai/sdk` | AgentService (PlannerAgent, CoderAgent, ReviewerAgent) | LLM API calls with streaming |
| `@dnd-kit/core` + `@dnd-kit/sortable` | KanbanBoard, KanbanColumn | Drag-and-drop task cards |
| `framer-motion` | TaskCard, PipelineVisualization, KanbanColumn, LogViewer, BottomDock | Layout animations, pulse effects, typing effect |
| `zod` | ValidationService, TaskCreationModal, LoginPage, RegisterPage | Schema validation (server + client) |
| `bcrypt` | AuthService | Password hashing |
| `@prisma/client` | All services (except DiffService, SSEService, ValidationService) | Database ORM |
| `lucide-react` | All icon usage across components | Icon library |
| shadcn/ui components | Dialog, Button, Input, Textarea, Select, DropdownMenu, Skeleton, Toast | Base UI primitives |
