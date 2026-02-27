# Unit of Work Dependencies -- AutoCoder

## Dependency Matrix

| Unit | UOW-01 | UOW-02 | UOW-03 | UOW-04 | UOW-05 | UOW-06 |
|------|--------|--------|--------|--------|--------|--------|
| **UOW-01** Foundation & Auth | -- | | | | | |
| **UOW-02** Project Management | **HARD** | -- | | | | |
| **UOW-03** Tasks & Kanban | **HARD** | **HARD** | -- | | | |
| **UOW-04** AI Pipeline Engine | **HARD** | SOFT | **HARD** | -- | | |
| **UOW-05** Pipeline UI & Logs | **HARD** | | **HARD** | **HARD** | -- | |
| **UOW-06** Diff Review & Polish | **HARD** | | **HARD** | **HARD** | **HARD** | -- |

**Legend**:
- **HARD** = Cannot start without predecessor complete. Code directly imports or extends predecessor artifacts.
- **SOFT** = Uses predecessor indirectly (e.g., UOW-04 inherits project ownership via TaskService from UOW-03, not UOW-02 directly).
- Empty = No dependency.

---

## Implementation Order

```
Phase 1:  UOW-01  Foundation & Auth          [~5 days]
             |
Phase 2:  UOW-02  Project Management         [~2 days]
             |
Phase 3:  UOW-03  Tasks & Kanban Board       [~5 days]
             |
Phase 4:  UOW-04  AI Pipeline Engine         [~5 days]
             |
Phase 5:  UOW-05  Pipeline UI & Agent Logs   [~3 days]
             |
Phase 6:  UOW-06  Diff Review & Polish       [~4 days]
```

**Total estimated**: ~24 days sequential

### Parallelization Opportunities

The dependency chain is strictly sequential at the unit level. However, within-unit parallelism is possible:

| Parallel Track | What | When |
|----------------|------|------|
| **UOW-03 + UOW-04 partial** | Pipeline prompt templates and agent wrappers (UOW-04) can be developed in isolation while Kanban UI (UOW-03) is built. Integration deferred until both complete. | Phase 3-4 |
| **UOW-05 + UOW-06 partial** | DiffService and DiffViewer (UOW-06) are stateless and can be developed concurrently with pipeline visualization (UOW-05). Integration deferred. | Phase 5-6 |
| **Settings page** | The Settings page (UOW-06) only depends on UOW-01 (auth). It can be built any time after Phase 1 and slotted in during Phase 6 integration. | Phase 2+ |

With two parallel developers, the critical path could compress to ~18 days.

---

## Integration Points

### UOW-01 -> UOW-02: Auth hooks into Project creation

| Integration | Detail |
|-------------|--------|
| **Default project** | `AuthService.register()` calls `ProjectService.createDefaultProject()` after user creation. Requires ProjectService to exist or be stubbed. |
| **Session context** | All ProjectService methods receive `userId` from auth middleware. |
| **Sidebar update** | Sidebar component (UOW-01 shell) updated to render ProjectSwitcher in UOW-02. |

### UOW-02 -> UOW-03: Project context drives Task queries

| Integration | Detail |
|-------------|--------|
| **Active project** | `taskStore.fetchTasks()` reads `projectStore.activeProjectId`. Board re-renders on project switch. |
| **Ownership chain** | TaskService validates task belongs to a project owned by the user. Chains through ProjectService. |
| **Header breadcrumb** | Header shows `projectStore.activeProject.name`. |

### UOW-03 -> UOW-04: Task triggers Pipeline

| Integration | Detail |
|-------------|--------|
| **Start pipeline** | "Create & Start" button in TaskCreationModal calls `POST /api/tasks/[id]/start-pipeline`. UOW-03 provides the button; UOW-04 provides the endpoint. |
| **Status updates** | PipelineOrchestrator calls `TaskService.updateTaskStatus()` to move cards across columns. |
| **Task model** | Task Prisma model includes `pipelineState` JSON field and `subtasks` JSON field, written by PipelineOrchestrator. |

### UOW-04 -> UOW-05: SSE feeds Pipeline UI

| Integration | Detail |
|-------------|--------|
| **SSE connection** | `useSSE(taskId)` hook opens `EventSource` to `GET /api/sse/[taskId]`. |
| **Event routing** | Hook demuxes SSE events: `agent-log` -> `pipelineStore.agentLogs`, `phase-change` -> `pipelineStore.activePipelines` + `taskStore.updateTask`, `task-status` -> `taskStore.updateTaskStatus`. |
| **Pipeline state** | `PipelineVisualization` reads `pipelineStore.activePipelines[taskId]` for current phase, completed phases, timing. |
| **Log streaming** | `AgentLogPanel` reads `pipelineStore.agentLogs[taskId]` for each agent tab. |

### UOW-05 -> UOW-06: Review state triggers Diff panel

| Integration | Detail |
|-------------|--------|
| **Conditional render** | TaskDetailView renders `DiffReviewPanel` when `task.status === 'review'`. Pipeline viz (UOW-05) sits above, diff panel (UOW-06) sits to the right. |
| **Approve/reject flow** | ReviewActions calls `POST /api/pipeline/[taskId]/approve` or `POST /api/pipeline/[taskId]/request-changes`. These trigger PipelineOrchestrator state transitions, which emit SSE events consumed by UOW-05 components. |
| **File changes data** | DiffReviewPanel reads `fileChanges` from PipelineRun record (persisted in UOW-04). DiffService (UOW-06) transforms this into renderable diff format. |

### Cross-cutting: UOW-06 Error Handling

| Integration | Detail |
|-------------|--------|
| **Error SSE events** | PipelineOrchestrator (UOW-04) emits `error` SSE events. UOW-06 adds toast notification UI and retry/cancel action buttons. |
| **Backoff countdown** | pipelineStore (UOW-04 defines, UOW-06 consumes) tracks retry countdown. UI shows "Retrying in Xs..." indicator. |
| **Settings -> Pipeline** | API key from Settings page (UOW-06) is validated before pipeline start (UOW-04 endpoint). Key passed via request header. |

---

## Risk Analysis

### UOW-01 -> UOW-02: Low Risk

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Prisma schema changes needed for Project model after UOW-01 | Low | Low | Define all models upfront in UOW-01 schema. Migration is trivial if needed. |
| Auth middleware interface changes | Low | Medium | Auth middleware contract is simple (return userId or 401). Unlikely to change. |

### UOW-02 -> UOW-03: Low Risk

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| projectStore API surface changes | Low | Low | Store interface is stable (projects, activeProjectId, setActiveProject). |

### UOW-03 -> UOW-04: Medium Risk

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Task model `pipelineState` JSON shape not finalized | Medium | Medium | Define TypeScript interface for pipelineState in UOW-03 types. Both units share the type. |
| "Create & Start" requires pipeline endpoint before UOW-04 | Medium | Low | UOW-03 can stub the endpoint (return 501) and wire it in UOW-04. Button works, pipeline doesn't start yet. |
| TaskService.updateTaskStatus called from both UI (drag) and server (pipeline) | Low | Medium | Both paths go through the same service method. Conflict unlikely since pipeline holds a lock. |

### UOW-04 -> UOW-05: Medium Risk

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| SSE event schema changes during UOW-04 development | Medium | Medium | Define SSE event types in `types/sse.ts` early. Shared contract between backend push and frontend consume. |
| SSE connection stability in dev (Next.js hot reload drops connections) | Medium | Low | useSSE hook includes auto-reconnect logic. Dev inconvenience only. |
| pipelineStore shape evolves after UOW-05 starts consuming it | Low | Medium | pipelineStore interface defined in UOW-04, consumed read-only in UOW-05. Changes are additive. |

### UOW-05 -> UOW-06: Low Risk

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| DiffReviewPanel layout conflicts with PipelineVisualization | Low | Low | Both render in TaskDetailView with clear slots (top vs side panel). CSS isolation sufficient. |
| Approve/request-changes endpoints interact with PipelineOrchestrator state machine | Medium | Medium | State transitions well-defined in UOW-04. UOW-06 just triggers them. Edge cases (e.g., approve during active pipeline) need guard checks. |

### Global Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Anthropic SDK streaming behavior changes | Low | High | Pin SDK version. Agent wrappers isolate SDK calls behind stable interface. |
| dnd-kit compatibility with React 19 / Next.js 15 | Medium | Medium | Verify compatibility before UOW-03. Fallback: manual drag implementation or alternative library. |
| Prisma migration drift across units | Low | Medium | Single schema file modified only in UOW-01. Subsequent units do not alter schema; they only use existing models. |
| SSE connection limits in browser (6 per domain) | Low | Low | Design uses one SSE connection per task. User views one task at a time. Not a practical limit. |
