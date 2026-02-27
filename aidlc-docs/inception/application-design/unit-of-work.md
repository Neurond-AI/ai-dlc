# Unit of Work Breakdown -- AutoCoder

## Code Organization Strategy

Full project directory structure for the Next.js 15 monolith:

```
src/
├── app/
│   ├── (auth)/                    # Login, Register pages
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── register/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/               # Protected routes
│   │   ├── board/
│   │   │   └── page.tsx           # Kanban board (main view)
│   │   ├── task/[id]/
│   │   │   └── page.tsx           # Task detail view
│   │   ├── settings/
│   │   │   └── page.tsx           # Settings page
│   │   └── layout.tsx             # AppShell wrapper
│   ├── api/
│   │   ├── auth/
│   │   │   ├── register/route.ts
│   │   │   ├── login/route.ts
│   │   │   ├── logout/route.ts
│   │   │   └── me/route.ts
│   │   ├── projects/
│   │   │   ├── route.ts           # GET list, POST create
│   │   │   └── [id]/route.ts      # PATCH rename, DELETE
│   │   ├── tasks/
│   │   │   ├── route.ts           # GET list, POST create
│   │   │   └── [id]/
│   │   │       ├── route.ts       # PATCH update, DELETE
│   │   │       └── start-pipeline/route.ts
│   │   ├── pipeline/
│   │   │   └── [taskId]/
│   │   │       ├── status/route.ts
│   │   │       ├── retry/route.ts
│   │   │       ├── cancel/route.ts
│   │   │       ├── approve/route.ts
│   │   │       └── request-changes/route.ts
│   │   └── sse/
│   │       └── [taskId]/route.ts
│   └── layout.tsx                 # Root layout
├── components/
│   ├── board/
│   │   ├── kanban-board.tsx
│   │   ├── kanban-column.tsx
│   │   └── empty-state.tsx
│   ├── pipeline/
│   │   ├── pipeline-visualization.tsx
│   │   ├── pipeline-node.tsx
│   │   └── pipeline-connector.tsx
│   ├── agent-log/
│   │   ├── agent-log-panel.tsx
│   │   ├── agent-log-tab.tsx
│   │   └── log-entry.tsx
│   ├── diff-review/
│   │   ├── diff-review-panel.tsx
│   │   ├── file-tree.tsx
│   │   ├── diff-viewer.tsx
│   │   └── review-actions.tsx
│   ├── task/
│   │   ├── task-card.tsx
│   │   ├── task-creation-modal.tsx
│   │   └── task-detail-view.tsx
│   ├── layout/
│   │   ├── app-shell.tsx
│   │   ├── sidebar.tsx
│   │   ├── header.tsx
│   │   └── bottom-dock.tsx
│   └── ui/                        # shadcn/ui components
│       ├── button.tsx
│       ├── input.tsx
│       ├── dialog.tsx
│       ├── select.tsx
│       ├── tabs.tsx
│       ├── tooltip.tsx
│       ├── toast.tsx
│       └── ...
├── lib/
│   ├── agents/
│   │   ├── planner-agent.ts
│   │   ├── coder-agent.ts
│   │   └── reviewer-agent.ts
│   ├── prompts/
│   │   ├── planner-prompt.ts
│   │   ├── coder-prompt.ts
│   │   └── reviewer-prompt.ts
│   ├── services/
│   │   ├── project-service.ts
│   │   ├── task-service.ts
│   │   ├── pipeline-orchestrator.ts
│   │   ├── sse-service.ts
│   │   ├── diff-service.ts
│   │   └── validation-service.ts
│   ├── db/
│   │   └── prisma.ts              # Prisma client singleton
│   ├── auth/
│   │   ├── auth-service.ts
│   │   ├── session.ts             # Session cookie utilities
│   │   └── middleware.ts          # Auth middleware
│   └── validations/
│       ├── auth-schemas.ts
│       ├── project-schemas.ts
│       ├── task-schemas.ts
│       └── pipeline-schemas.ts
├── stores/
│   ├── auth-store.ts
│   ├── ui-store.ts
│   ├── project-store.ts
│   ├── task-store.ts
│   └── pipeline-store.ts
├── hooks/
│   ├── use-sse.ts
│   └── use-auto-scroll.ts
├── types/
│   ├── task.ts
│   ├── project.ts
│   ├── pipeline.ts
│   ├── agent.ts
│   └── sse.ts
└── prisma/
    └── schema.prisma
```

---

## UOW-01: Foundation & Auth

**Purpose**: Stand up the full project skeleton and authentication system so all subsequent units have infrastructure and protected routes to build on.

**Scope**:
- Next.js 15 project scaffolding (App Router, TypeScript strict)
- Prisma schema definition (User, Project, Task, PipelineRun models)
- Docker Compose for local PostgreSQL
- Tailwind CSS v4 + shadcn/ui initialization
- Auth: register, login, logout, session middleware, protected route redirect
- Base layout shell: AppShell, Sidebar (nav icons only), Header (user menu + logout), BottomDock (empty shell)
- Zustand stores: authStore, uiStore

**Key Components**:

| Category | Items |
|----------|-------|
| UI Components | `AppShell`, `Sidebar`, `Header`, `BottomDock`, `LoginForm`, `RegisterForm` |
| Services | `AuthService`, `ValidationService` (auth schemas only) |
| Stores | `authStore`, `uiStore` |
| API Routes | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` |
| Infrastructure | `prisma/schema.prisma`, `docker-compose.yml`, `lib/db/prisma.ts`, `lib/auth/session.ts`, `lib/auth/middleware.ts` |
| Types | `types/project.ts` (stub), `types/task.ts` (stub) |

**Dependencies**: None (foundation unit)

**Estimated Complexity**: High
- Reason: Heaviest setup overhead (tooling, DB, auth, layout). All other units depend on this.

**Code Organization**:
```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   └── layout.tsx              # AppShell wrapper + auth guard
│   ├── api/auth/
│   │   ├── register/route.ts
│   │   ├── login/route.ts
│   │   ├── logout/route.ts
│   │   └── me/route.ts
│   └── layout.tsx
├── components/
│   ├── layout/
│   │   ├── app-shell.tsx
│   │   ├── sidebar.tsx
│   │   ├── header.tsx
│   │   └── bottom-dock.tsx
│   └── ui/                         # shadcn/ui base components
├── lib/
│   ├── auth/
│   │   ├── auth-service.ts
│   │   ├── session.ts
│   │   └── middleware.ts
│   ├── db/prisma.ts
│   ├── services/validation-service.ts
│   └── validations/auth-schemas.ts
├── stores/
│   ├── auth-store.ts
│   └── ui-store.ts
├── types/
│   ├── project.ts
│   └── task.ts
├── prisma/schema.prisma
└── docker-compose.yml
```

**Stories**: US-001 through US-006

---

## UOW-02: Project Management

**Purpose**: Enable multi-project support so users can organize tasks by codebase, with a default project created on first login.

**Scope**:
- ProjectService: full CRUD with ownership enforcement, last-project-delete prevention
- Project switcher dropdown in Sidebar
- Default project auto-creation on registration (hooked into AuthService)
- API routes for project operations
- Zustand projectStore with active project tracking

**Key Components**:

| Category | Items |
|----------|-------|
| UI Components | `ProjectSwitcher` (integrated into `Sidebar`) |
| Services | `ProjectService` |
| Stores | `projectStore` |
| API Routes | `GET /api/projects`, `POST /api/projects`, `PATCH /api/projects/[id]`, `DELETE /api/projects/[id]` |
| Validations | `validations/project-schemas.ts` |
| Types | `types/project.ts` (full) |

**Dependencies**: UOW-01 (auth, Prisma schema, layout shell)

**Estimated Complexity**: Low
- Reason: Standard CRUD pattern. Prisma models already defined in UOW-01. Straightforward ownership check.

**Code Organization**:
```
src/
├── app/api/projects/
│   ├── route.ts                    # GET list, POST create
│   └── [id]/route.ts              # PATCH rename, DELETE
├── components/layout/
│   └── sidebar.tsx                 # Updated: add ProjectSwitcher
├── lib/
│   ├── services/project-service.ts
│   └── validations/project-schemas.ts
├── stores/project-store.ts
└── types/project.ts
```

**Stories**: US-007 through US-011

---

## UOW-03: Tasks & Kanban Board

**Purpose**: Build the core task management UI with a 5-column Kanban board, drag-and-drop, task creation modal, and task cards with rich metadata display.

**Scope**:
- TaskService: CRUD, status transitions, project-scoped queries
- Task creation modal with title, description, category, priority, dual-action (Create / Create & Start)
- Kanban board: 5 columns (Backlog, Spec, Building, Review, Done)
- dnd-kit drag-and-drop with drop placeholders and optimistic updates
- Task cards: phase indicator, pulse dot, category badge, subtask count, timestamp
- Empty state, loading skeletons, filter/search
- Task detail view (page shell, pipeline + diff slots empty until UOW-05/06)

**Key Components**:

| Category | Items |
|----------|-------|
| UI Components | `KanbanBoard`, `KanbanColumn`, `TaskCard`, `TaskCreationModal`, `TaskDetailView` (shell), `EmptyState` |
| Services | `TaskService` |
| Stores | `taskStore` |
| API Routes | `GET /api/tasks`, `POST /api/tasks`, `PATCH /api/tasks/[id]`, `DELETE /api/tasks/[id]` |
| Validations | `validations/task-schemas.ts` |
| Types | `types/task.ts` (full) |
| Pages | `(dashboard)/board/page.tsx`, `(dashboard)/task/[id]/page.tsx` |

**Dependencies**: UOW-01 (auth, layout), UOW-02 (projectStore for active project context)

**Estimated Complexity**: High
- Reason: dnd-kit integration, animated card transitions, optimistic state updates, dual-action creation flow.

**Code Organization**:
```
src/
├── app/(dashboard)/
│   ├── board/page.tsx
│   └── task/[id]/page.tsx
├── app/api/tasks/
│   ├── route.ts                    # GET list, POST create
│   └── [id]/route.ts              # PATCH update, DELETE
├── components/
│   ├── board/
│   │   ├── kanban-board.tsx
│   │   ├── kanban-column.tsx
│   │   └── empty-state.tsx
│   └── task/
│       ├── task-card.tsx
│       ├── task-creation-modal.tsx
│       └── task-detail-view.tsx
├── lib/
│   ├── services/task-service.ts
│   └── validations/task-schemas.ts
├── stores/task-store.ts
└── types/task.ts
```

**Stories**: US-012 through US-024

---

## UOW-04: AI Pipeline Engine (Backend)

**Purpose**: Implement the server-side AI pipeline -- agent wrappers, prompt templates, state-machine orchestrator, and SSE streaming -- so tasks can be processed autonomously by Planner/Coder/Reviewer agents.

**Scope**:
- AgentService: PlannerAgent, CoderAgent, ReviewerAgent (Anthropic TS SDK wrappers)
- Prompt templates: planner-prompt.ts, coder-prompt.ts, reviewer-prompt.ts
- PipelineOrchestrator: state machine (IDLE -> PLANNING -> CODING -> REVIEWING -> FIXING loop -> COMPLETED/FAILED), max 3 iterations
- SSEService: connection registry, typed event push (agent-log, phase-change, task-status, error, pipeline-complete)
- SSE endpoint: GET /api/sse/[taskId]
- Pipeline API routes: status, retry, cancel
- Start-pipeline endpoint: POST /api/tasks/[id]/start-pipeline
- Zustand pipelineStore (server-state mirrored via SSE)

**Key Components**:

| Category | Items |
|----------|-------|
| Services | `PipelineOrchestrator`, `PlannerAgent`, `CoderAgent`, `ReviewerAgent`, `SSEService` |
| Prompts | `planner-prompt.ts`, `coder-prompt.ts`, `reviewer-prompt.ts` |
| Stores | `pipelineStore` |
| API Routes | `POST /api/tasks/[id]/start-pipeline`, `GET /api/sse/[taskId]`, `GET /api/pipeline/[taskId]/status`, `POST /api/pipeline/[taskId]/retry`, `POST /api/pipeline/[taskId]/cancel` |
| Validations | `validations/pipeline-schemas.ts` |
| Types | `types/pipeline.ts`, `types/agent.ts`, `types/sse.ts` |

**Dependencies**: UOW-01 (auth, Prisma), UOW-02 (project ownership), UOW-03 (TaskService for status updates)

**Estimated Complexity**: High
- Reason: Most complex service logic. State machine, streaming, retry/backoff, SSE connection management, Anthropic SDK integration.

**Code Organization**:
```
src/
├── app/api/
│   ├── tasks/[id]/start-pipeline/route.ts
│   ├── pipeline/[taskId]/
│   │   ├── status/route.ts
│   │   ├── retry/route.ts
│   │   └── cancel/route.ts
│   └── sse/[taskId]/route.ts
├── lib/
│   ├── agents/
│   │   ├── planner-agent.ts
│   │   ├── coder-agent.ts
│   │   └── reviewer-agent.ts
│   ├── prompts/
│   │   ├── planner-prompt.ts
│   │   ├── coder-prompt.ts
│   │   └── reviewer-prompt.ts
│   ├── services/
│   │   ├── pipeline-orchestrator.ts
│   │   └── sse-service.ts
│   └── validations/pipeline-schemas.ts
├── stores/pipeline-store.ts
├── hooks/use-sse.ts
└── types/
    ├── pipeline.ts
    ├── agent.ts
    └── sse.ts
```

**Stories**: US-025 through US-032

---

## UOW-05: Pipeline UI & Agent Logs

**Purpose**: Build the frontend visualization layer -- pipeline flow diagram, agent log panel with streaming text, and SSE-driven real-time updates -- so users can monitor AI pipeline progress live.

**Scope**:
- PipelineVisualization: horizontal flow (Spec -> Plan -> Code -> Review -> Done), animated nodes, phase timing
- PipelineNode: state-driven visuals (inactive, pulsing, checkmark, failed)
- PipelineConnector: animated connecting lines
- AgentLogPanel: bottom dock content, tabbed (Planner/Coder/Reviewer)
- Streaming text with typing effect, auto-scroll, color-coding, timestamps
- useSSE hook connecting SSE events to pipelineStore + taskStore
- Integration into TaskDetailView (pipeline viz at top, log panel in bottom dock)

**Key Components**:

| Category | Items |
|----------|-------|
| UI Components | `PipelineVisualization`, `PipelineNode`, `PipelineConnector`, `AgentLogPanel`, `AgentLogTab`, `LogEntry` |
| Hooks | `useSSE`, `useAutoScroll` |
| Store Updates | `pipelineStore` (consume SSE events), `taskStore` (auto-move cards on phase change) |

**Dependencies**: UOW-01 (layout, BottomDock), UOW-03 (TaskDetailView shell, taskStore), UOW-04 (pipelineStore, SSE endpoint, pipeline types)

**Estimated Complexity**: Medium
- Reason: Primarily frontend. Animations with Framer Motion, SSE consumption, typing effect. No new backend services.

**Code Organization**:
```
src/
├── components/
│   ├── pipeline/
│   │   ├── pipeline-visualization.tsx
│   │   ├── pipeline-node.tsx
│   │   └── pipeline-connector.tsx
│   ├── agent-log/
│   │   ├── agent-log-panel.tsx
│   │   ├── agent-log-tab.tsx
│   │   └── log-entry.tsx
│   └── task/
│       └── task-detail-view.tsx    # Updated: integrate pipeline viz
├── hooks/
│   ├── use-sse.ts                  # Updated: full implementation
│   └── use-auto-scroll.ts
├── components/layout/
│   └── bottom-dock.tsx             # Updated: wire AgentLogPanel
└── stores/
    ├── pipeline-store.ts           # Updated: SSE event handlers
    └── task-store.ts               # Updated: auto-move on phase-change
```

**Stories**: US-033 through US-041

---

## UOW-06: Diff Review & Polish

**Purpose**: Complete the human review workflow with a diff viewer, file tree, approve/reject/retry actions, error handling UX, and settings page for API key management.

**Scope**:
- DiffReviewPanel: side panel in task detail, file tree + side-by-side diff with syntax highlighting
- DiffService: convert file changes JSON to unified diff format
- FileTree: collapsible directory tree with change-type icons
- DiffViewer: side-by-side with syntax highlighting (additions green, deletions red)
- ReviewActions: Approve, Request Changes (with feedback textarea), Retry (with confirmation)
- Pipeline API routes: approve, request-changes (new in this unit)
- Error handling UX: API failure toast, retry/cancel buttons, exponential backoff countdown
- Settings page: API key management (add, validate, update, remove, masked display), profile editing

**Key Components**:

| Category | Items |
|----------|-------|
| UI Components | `DiffReviewPanel`, `FileTree`, `DiffViewer`, `ReviewActions`, `SettingsPage`, `ApiKeyForm` |
| Services | `DiffService` |
| API Routes | `POST /api/pipeline/[taskId]/approve`, `POST /api/pipeline/[taskId]/request-changes` |
| Pages | `(dashboard)/settings/page.tsx` |

**Dependencies**: UOW-01 (auth, layout), UOW-03 (TaskDetailView), UOW-04 (pipeline API, pipelineStore, SSE events), UOW-05 (pipeline visualization context)

**Estimated Complexity**: Medium
- Reason: Diff rendering and syntax highlighting use existing libraries. Review actions are thin API calls. Settings page is standard forms. No new state machines.

**Code Organization**:
```
src/
├── app/(dashboard)/settings/page.tsx
├── app/api/pipeline/[taskId]/
│   ├── approve/route.ts
│   └── request-changes/route.ts
├── components/
│   ├── diff-review/
│   │   ├── diff-review-panel.tsx
│   │   ├── file-tree.tsx
│   │   ├── diff-viewer.tsx
│   │   └── review-actions.tsx
│   ├── settings/
│   │   └── api-key-form.tsx
│   └── task/
│       └── task-detail-view.tsx    # Updated: integrate DiffReviewPanel
├── lib/services/diff-service.ts
└── stores/pipeline-store.ts        # Updated: approve/requestChanges actions
```

**Stories**: US-042 through US-054

---

## Summary Table

| Unit | ID | Stories | Depends On | Complexity | Primary Focus |
|------|----|---------|------------|------------|---------------|
| Foundation & Auth | UOW-01 | US-001 -- US-006 | -- | High | Infrastructure + Auth |
| Project Management | UOW-02 | US-007 -- US-011 | UOW-01 | Low | CRUD + Sidebar |
| Tasks & Kanban Board | UOW-03 | US-012 -- US-024 | UOW-01, UOW-02 | High | Board UI + DnD |
| AI Pipeline Engine | UOW-04 | US-025 -- US-032 | UOW-01, UOW-02, UOW-03 | High | Agents + SSE + State Machine |
| Pipeline UI & Agent Logs | UOW-05 | US-033 -- US-041 | UOW-01, UOW-03, UOW-04 | Medium | Visualization + Streaming UI |
| Diff Review & Polish | UOW-06 | US-042 -- US-054 | UOW-01, UOW-03, UOW-04, UOW-05 | Medium | Review UX + Settings |
