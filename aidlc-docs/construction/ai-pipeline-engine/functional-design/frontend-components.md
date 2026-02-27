# Frontend Components -- UOW-04: AI Pipeline Engine

## Overview

UOW-04 is primarily a backend unit. This document defines the **client-side integration points** required for the pipeline engine to communicate with the frontend. These are hooks, a Zustand store, and minimal UI controls. Full pipeline visualization (UOW-05) and diff review UI (UOW-06) build on top of these integration points.

---

## Hooks

### useSSE

| Field | Value |
|-------|-------|
| **File** | `src/hooks/use-sse.ts` |
| **Type** | Custom React Hook |
| **Purpose** | Establish SSE connection to server, parse typed events, dispatch to Zustand stores |

**Parameters**:
```ts
interface UseSSEOptions {
  taskId: string | null;    // null = no connection
  enabled?: boolean;        // default: true. Set false to disconnect.
}
```

**Return Value**:
```ts
interface UseSSEReturn {
  isConnected: boolean;     // SSE connection active
  error: string | null;     // Connection-level error message
  reconnect: () => void;    // Manual reconnect trigger
}
```

**Internal State**:
- `eventSource: EventSource | null` -- native browser EventSource instance
- `isConnected: boolean` -- tracks connection state
- `reconnectAttempts: number` -- auto-reconnect counter (max 3)

**SSE Event Handling**:
```ts
// On each SSE message:
eventSource.onmessage = (event) => {
  const parsed: SSEEvent = JSON.parse(event.data);

  switch (parsed.type) {
    case "agent-log":
      pipelineStore.appendLog(taskId, parsed.data.agent, parsed.data.chunk, parsed.data.timestamp);
      break;
    case "phase-change":
      pipelineStore.updatePhase(taskId, parsed.data.phase, parsed.data.status, parsed.data.iteration);
      break;
    case "task-status":
      taskStore.updateTaskStatus(parsed.data.taskId, parsed.data.newStatus);
      break;
    case "error":
      pipelineStore.setError(taskId, parsed.data);
      break;
    case "pipeline-complete":
      pipelineStore.setComplete(taskId, parsed.data.result, parsed.data.fileChanges, parsed.data.reviewFindings);
      break;
    case "timeout":
      // Connection will close; trigger reconnect if pipeline still active
      break;
  }
};
```

**Connection Lifecycle**:
```
[1] useEffect watches taskId + enabled
[2] If taskId is non-null and enabled:
    - Create EventSource: new EventSource(`/api/sse/${taskId}`)
    - Set onopen -> isConnected = true
    - Set onmessage -> parse and dispatch (above)
    - Set onerror -> isConnected = false, attempt auto-reconnect (max 3, with 1s/2s/4s delay)
[3] Cleanup on unmount or taskId change:
    - eventSource.close()
    - isConnected = false
```

**API Calls**: None (SSE is a read-only stream from server).

**Business Rules**: BR-04-015 (10-minute timeout; hook handles reconnection)

**Notes**:
- Uses native `EventSource` API (no external library needed)
- Named events (event: agent-log) require `addEventListener` per event type OR a single `onmessage` handler that parses the event type from the data payload
- Credentials included via `withCredentials: true` for session cookie

---

### usePipeline

| Field | Value |
|-------|-------|
| **File** | `src/hooks/use-pipeline.ts` |
| **Type** | Custom React Hook |
| **Purpose** | Wrap pipelineStore actions with API calls and loading state |

**Parameters**:
```ts
interface UsePipelineOptions {
  taskId: string;
}
```

**Return Value**:
```ts
interface UsePipelineReturn {
  // State (from pipelineStore)
  pipelineRun: PipelineRunState | null;
  agentLogs: AgentLogsState | null;
  isRunning: boolean;         // derived: status === "running"
  isPaused: boolean;          // derived: status === "paused"
  isCompleted: boolean;       // derived: status === "passed" || "failed" || "cancelled"

  // Actions
  startPipeline: () => Promise<void>;
  retryPipeline: () => Promise<void>;
  cancelPipeline: () => Promise<void>;
  approvePipeline: () => Promise<void>;
  requestChanges: (feedback: string) => Promise<void>;

  // Loading state per action
  isStarting: boolean;
  isRetrying: boolean;
  isCancelling: boolean;
  isApproving: boolean;
  isRequestingChanges: boolean;

  // Error
  actionError: string | null;
}
```

**State Management**:
- Reads from `pipelineStore`: `pipelineRuns.get(taskId)`, `agentLogs.get(taskId)`
- Derives boolean flags from `pipelineRun.status`
- Manages per-action `isLoading` and `error` via local `useState`

**API Calls**:

| Action | Endpoint | Method | Body | On Success | On Error |
|--------|----------|--------|------|-----------|----------|
| startPipeline | `/api/tasks/${taskId}/start-pipeline` | POST | none (API key in header) | pipelineStore.startPipeline(taskId, runId) | Set actionError |
| retryPipeline | `/api/pipeline/${taskId}/retry` | POST | none | pipelineStore clears error (via SSE) | Set actionError |
| cancelPipeline | `/api/pipeline/${taskId}/cancel` | POST | none | pipelineStore updates (via SSE) | Set actionError |
| approvePipeline | `/api/pipeline/${taskId}/approve` | POST | none | taskStore updates (via SSE) | Set actionError |
| requestChanges | `/api/pipeline/${taskId}/request-changes` | POST | `{ feedback }` | pipeline resumes (via SSE) | Set actionError |

**API Key Handling**:
```ts
// Before startPipeline:
const apiKey = getDecryptedApiKey(); // from localStorage utility
if (!apiKey) {
  setActionError("API key required. Configure in Settings.");
  return;
}
// Include in headers:
headers: { "x-anthropic-key": apiKey }
```

**Business Rules**: BR-04-001, BR-04-002, BR-04-004, BR-04-014

---

## UI Components

### PipelineControls

| Field | Value |
|-------|-------|
| **File** | `src/components/pipeline/pipeline-controls.tsx` |
| **Type** | Client Component (`"use client"`) |
| **Purpose** | Render context-appropriate pipeline action buttons within Task Detail view |

**Props Interface**:
```ts
interface PipelineControlsProps {
  taskId: string;
}
```

**Internal State**:
- Uses `usePipeline(taskId)` hook for all state and actions
- No local state beyond what the hook provides

**Rendered States**:

| Pipeline State | Buttons Shown | Button States |
|---------------|---------------|--------------|
| No pipeline (null) | [Start Pipeline] | Enabled if task in backlog/spec |
| Running | [Cancel Pipeline] | Enabled |
| Paused (error) | [Retry] [Cancel] | Retry: enabled if retryCount < 3. Cancel: enabled. |
| Completed (passed) | [Approve] [Request Changes] [Retry] | All enabled |
| Failed | [Retry Pipeline] | Enabled (restarts from scratch) |
| Cancelled | [Start Pipeline] | Enabled (starts fresh) |

**User Interactions**:

| Action | Handler | Result |
|--------|---------|--------|
| Click "Start Pipeline" | `usePipeline.startPipeline()` | POST to start endpoint, button shows spinner |
| Click "Cancel Pipeline" | Confirmation dialog -> `usePipeline.cancelPipeline()` | POST to cancel endpoint |
| Click "Retry" (paused) | `usePipeline.retryPipeline()` | POST to retry endpoint |
| Click "Retry Pipeline" (failed) | Confirmation dialog -> `usePipeline.startPipeline()` | Fresh pipeline start |
| Click "Approve" | `usePipeline.approvePipeline()` | POST to approve, task -> done |
| Click "Request Changes" | Opens feedback textarea -> submit -> `usePipeline.requestChanges(feedback)` | POST with feedback, pipeline resumes |

**UI Elements**:
- `<Button>` (shadcn/ui) for each action, with loading spinner when corresponding `isLoading` is true
- Disabled states based on pipeline status
- Tooltip on disabled buttons explaining why (e.g., "Pipeline already running")
- Confirmation `<AlertDialog>` (shadcn/ui) for destructive actions (Cancel, Retry from scratch)
- `<Textarea>` (shadcn/ui) for "Request Changes" feedback input

**Business Rules**: BR-04-001, BR-04-002, BR-04-014

---

### ErrorNotification

| Field | Value |
|-------|-------|
| **File** | `src/components/pipeline/error-notification.tsx` |
| **Type** | Client Component (`"use client"`) |
| **Purpose** | Display pipeline error as toast/banner with retry and cancel actions |

**Props Interface**:
```ts
interface ErrorNotificationProps {
  taskId: string;
}
```

**Internal State**:
- Reads from `pipelineStore`: `pipelineRuns.get(taskId).errorDetails`
- Uses `usePipeline(taskId)` for retry/cancel actions
- `isVisible: boolean` -- controlled by error presence and user dismissal

**Trigger Condition**:
- Renders when `pipelineRun.status === "paused"` AND `errorDetails !== null`
- Auto-shows as a toast notification via Sonner AND persists as inline banner in task detail

**Display Content**:
```
+--------------------------------------------------------------+
| [!] Pipeline Error                                    [X]     |
|                                                               |
| Anthropic API error: 429 Rate Limited                         |
| Agent: Coder | Phase: Coding | Retry 1/3                     |
|                                                               |
| [Retry]  [Cancel Pipeline]                                    |
+--------------------------------------------------------------+
```

**User Interactions**:

| Action | Handler | Result |
|--------|---------|--------|
| Click "Retry" | `usePipeline.retryPipeline()` | Dismiss notification, pipeline retries with backoff |
| Click "Cancel Pipeline" | `usePipeline.cancelPipeline()` | Dismiss notification, pipeline cancelled |
| Click "X" (dismiss) | Set `isVisible = false` | Hide banner (buttons remain in PipelineControls) |

**Toast Behavior** (via Sonner):
- On error event received: fire `toast.error()` with error message
- Toast auto-dismisses after 10 seconds but banner persists
- Toast includes "Retry" action button inline

**UI Elements**:
- Sonner `toast.error()` for non-intrusive notification
- Inline `<Alert>` (shadcn/ui) variant="destructive" for persistent banner
- Error icon (AlertTriangle from Lucide)
- Retry countdown display: "Retrying in Xs..." (driven by SSE agent-log events during backoff)

**Business Rules**: BR-04-017 (backoff timing displayed), BR-04-004 (API key errors show "Update key in Settings" link)

---

## Zustand Store (pipelineStore)

### Store Definition

| Field | Value |
|-------|-------|
| **File** | `src/stores/pipeline-store.ts` |
| **Type** | Zustand store (with `immer` middleware for immutable updates) |
| **Purpose** | Client-side state for active pipeline runs, agent logs, and pipeline actions |

**State Shape**:
```ts
interface PipelineStoreState {
  // Pipeline run state per task
  pipelineRuns: Map<string, PipelineRunState>;

  // Agent log entries per task, per agent
  agentLogs: Map<string, AgentLogsState>;
}
```

**Actions**:

| Action | Signature | Behavior |
|--------|-----------|----------|
| `startPipeline` | `(taskId: string, runId: string) => void` | Initialize `pipelineRuns[taskId]` with runId, phase="planning", status="running", iteration=0. Initialize `agentLogs[taskId]` with empty arrays. |
| `updatePhase` | `(taskId: string, phase, status, iteration) => void` | Update `pipelineRuns[taskId]` fields. Called by useSSE on "phase-change" events. |
| `appendLog` | `(taskId: string, agent, chunk, timestamp) => void` | Push `{ chunk, timestamp }` to `agentLogs[taskId][agent]`. Called by useSSE on "agent-log" events. |
| `setError` | `(taskId: string, errorDetails: ErrorDetails) => void` | Set `pipelineRuns[taskId].errorDetails` and `status = "paused"`. Called by useSSE on "error" events. |
| `setComplete` | `(taskId, result, fileChanges?, reviewFindings?) => void` | Set final status ("passed" or "failed"), store file changes and review findings, set `completedAt`. Called by useSSE on "pipeline-complete" events. |
| `retryPipeline` | `(taskId: string) => void` | Clear `errorDetails`, set status back to "running". (Optimistic; server confirms via SSE.) |
| `cancelPipeline` | `(taskId: string) => void` | Set status to "cancelled", phase to "cancelled". (Optimistic; server confirms via SSE.) |
| `clearLogs` | `(taskId: string) => void` | Reset `agentLogs[taskId]` to `{ planner: [], coder: [], reviewer: [] }`. |
| `removePipeline` | `(taskId: string) => void` | Delete entries from both `pipelineRuns` and `agentLogs` maps. Used on task deletion. |

**Selectors** (for component consumption):
```ts
// Get pipeline run for a specific task
usePipelineStore((state) => state.pipelineRuns.get(taskId));

// Get agent logs for a specific task
usePipelineStore((state) => state.agentLogs.get(taskId));

// Check if any pipeline is running (for BottomDock activity indicator)
usePipelineStore((state) =>
  Array.from(state.pipelineRuns.values()).some((run) => run.status === "running")
);
```

**Persistence**: None. Pipeline state is ephemeral on the client; source of truth is the server DB. On page reload, state is re-fetched via GET /api/pipeline/[taskId]/status and SSE reconnection.

---

## Component-Store-SSE Data Flow

```
Server (PipelineOrchestrator)
  |
  |-- SSEService.push(taskId, event) -----> SSE Connection (GET /api/sse/[taskId])
                                               |
                                               v
                                          useSSE hook (parses events)
                                               |
                          +--------------------+-------------------+
                          |                    |                   |
                          v                    v                   v
                    pipelineStore         taskStore           (toast via Sonner)
                    .updatePhase()       .updateTaskStatus()   on error events
                    .appendLog()
                    .setError()
                    .setComplete()
                          |                    |
                          v                    v
                    PipelineControls      KanbanBoard
                    ErrorNotification     (card moves automatically)
                    (UOW-05: viz, logs)
```

---

## Store Usage by Component

| Component | pipelineStore | taskStore | Notes |
|-----------|--------------|-----------|-------|
| useSSE hook | write (all actions) | write (updateTaskStatus) | Dispatches all SSE events |
| usePipeline hook | read (run, logs) | - | Derives boolean flags, wraps API calls |
| PipelineControls | read (via usePipeline) | - | Renders action buttons |
| ErrorNotification | read (errorDetails) | - | Shows error banner/toast |
| BottomDock (UOW-01) | read (any running?) | - | Activity indicator dot |
| TaskCard (UOW-03) | read (phase, status) | - | Pulse dot, phase indicator |

---

## shadcn/ui Components Required (UOW-04 Frontend)

| Component | Used By | Purpose |
|-----------|---------|---------|
| Button | PipelineControls | Start/Cancel/Retry/Approve actions |
| AlertDialog | PipelineControls | Confirmation for destructive actions |
| Alert | ErrorNotification | Error banner display |
| Textarea | PipelineControls | "Request Changes" feedback input |
| Tooltip | PipelineControls | Disabled button explanations |
| Sonner (toast) | ErrorNotification | Error/success notifications |
