# Business Logic Model -- UOW-05: Pipeline UI & Agent Logs

## Overview

This document defines the business processes for UOW-05, covering the frontend visualization layer: pipeline flow diagram, agent log panel with streaming text, and SSE-driven real-time updates. All components are client-side React components consuming the `pipelineStore` and `taskStore` defined in UOW-04. No new backend services or API routes are introduced. Animations use **Framer Motion**. Log streaming uses the **useSSE** hook (UOW-04) to receive SSE events and dispatch to Zustand stores.

---

## 1. Pipeline Visualization Flow

**Trigger**: TaskDetailView mounts with a taskId that has an active or completed PipelineRun.

```
TaskDetailView (UOW-03 shell, updated in UOW-05)
  |
  [1] Render PipelineVisualization at top of detail view
      Props: { taskId }
  |
  [2] PipelineVisualization reads pipelineStore:
      - pipelineRun = pipelineStore.pipelineRuns.get(taskId)
      - If null: render all 5 nodes in "pending" state (dimmed)
      - If present: map pipelineRun.phase to active node
  |
  [3] Render 5 PipelineNodes with 4 PipelineConnectors between them:
      [Spec] ---> [Plan] ---> [Code] ---> [Review] ---> [Done]
  |
  [4] Each PipelineNode receives:
      - phase: one of "spec" | "plan" | "code" | "review" | "done"
      - status: derived from pipelineRun.phase comparison
        - "completed" if node's phase < current phase
        - "active" if node's phase === current phase
        - "failed" if pipeline failed at this phase
        - "pending" if node's phase > current phase
      - timing: { startedAt, completedAt, duration } from phase timing map
  |
  [5] Each PipelineConnector receives:
      - filled: true if the phase AFTER this connector is completed or active
      - animated: true if the phase AFTER this connector is the current active phase
```

**Phase-to-Node Mapping**:

| Pipeline Phase (from SSE) | Visualization Node | Status |
|---------------------------|-------------------|--------|
| planning | Spec | active |
| coding | Code | active (Spec + Plan = completed) |
| reviewing | Review | active (Spec + Plan + Code = completed) |
| fixing | Code | active (iteration > 0 indicated) |
| completed | Done | active -> completed (all nodes filled) |
| failed | (failed phase node) | failed (red) |
| cancelled | (last active node) | pending (all reset) |
| paused | (current phase node) | active (with warning indicator) |

**Node Mapping Detail**:

The pipeline has 5 server phases but 5 visualization nodes. The mapping:
- "planning" phase -> "Spec" node active (planner generates spec/subtasks)
- After planning completes -> "Plan" node completed (subtasks stored)
- "coding" phase -> "Code" node active
- "reviewing" phase -> "Review" node active
- "completed" phase -> "Done" node active then completed
- "fixing" phase -> "Code" node re-activates (shows iteration badge)

---

## 2. Pipeline Node State Machine

**Per-Node State Transitions** (driven by pipelineStore.updatePhase events):

```
PENDING --> ACTIVE --> COMPLETED
                  |
                  +--> FAILED (terminal for this run)
```

**Visual States**:

| State | Icon | Background | Border | Animation |
|-------|------|-----------|--------|-----------|
| pending | Default icon (dimmed) | transparent | border-muted | none |
| active | Default icon (full color) | phase color / 10 | phase color | scale pulse (Framer Motion) |
| completed | CheckCircle2 (Lucide) | green/10 | green | none (static) |
| failed | XCircle (Lucide) | red/10 | red | none (static) |

**Framer Motion for Active Node**:
```ts
animate={{
  scale: [1, 1.05, 1],
  boxShadow: [
    "0 0 0 0 rgba(color, 0)",
    "0 0 0 8px rgba(color, 0.15)",
    "0 0 0 0 rgba(color, 0)"
  ]
}}
transition={{
  duration: 2,
  repeat: Infinity,
  ease: "easeInOut"
}}
```

---

## 3. Pipeline Connector Animation

**Trigger**: pipelineStore.updatePhase sets a new active phase.

```
PipelineConnector between Node A and Node B:
  |
  [1] Read status of Node B (the right-side node):
      - If B is "pending": connector is gray, no fill
      - If B is "active": connector animates gradient fill from left to right
      - If B is "completed": connector is fully filled (solid color)
      - If B is "failed": connector fills up to failure point (partial)
  |
  [2] Animation (Framer Motion):
      - Gradient bar inside connector track
      - initial: { width: "0%" }
      - animate: { width: "100%" }
      - transition: { duration: 0.8, ease: "easeOut" }
  |
  [3] Color: matches the phase color of Node B
```

**Connector Layout**:
```
[Node A] ════════════════ [Node B]
          ^
          |-- 48px wide line, 2px height
          |-- track: bg-muted (gray)
          |-- fill: bg-{phase-color} (animated width)
```

---

## 4. Phase Timing Display

**Component**: PipelineTimer (rendered below each PipelineNode)

**Logic**:
```
PipelineTimer({ phase, pipelineRun }):
  |
  [1] Compute phase timing from pipelineStore:
      - Each phase-change SSE event includes timestamp
      - Store tracks phaseTimings: Map<phase, { startedAt, completedAt }>
      - phaseTimings updated in pipelineStore.updatePhase action
  |
  [2] Determine display:
      - If phase not yet started: show nothing
      - If phase is active (running):
          - Live timer: startedAt -> now(), updated every 1000ms via setInterval
          - Format: MM:SS (e.g., "01:23")
      - If phase is completed:
          - Static duration: completedAt - startedAt
          - Format: Xs (for <60s) or M:SS (for >=60s)
          - Example: "12s" or "1:45"
  |
  [3] Live timer cleanup: clearInterval on unmount or phase change
```

**Timer Format Rules**:
- Active phase: `MM:SS` with leading zeros (00:05, 01:23)
- Completed phase < 60s: `Xs` (12s)
- Completed phase >= 60s: `M:SS` (1:45)
- Not started: empty / hidden

---

## 5. Agent Log Panel

**Trigger**: AgentLogPanel renders inside BottomDock (UOW-01 shell, wired in UOW-05).

```
BottomDock (UOW-01 updated)
  |
  [1] Contains AgentLogPanel as its content
  |
  [2] Collapse/Expand behavior:
      - Collapsed: 36px bar with toggle button + activity indicator
      - Expanded: 300px default height, resizable via drag handle
      - Max height: 50vh
      - Transition: Framer Motion height animation (200ms spring)
  |
  [3] Activity indicator (when collapsed):
      - If any pipelineRun has status "running" -> show pulsing dot
      - Dot color matches current active agent tab color
  |
AgentLogPanel
  |
  [4] Tabs: Planner (amber), Coder (blue), Reviewer (purple)
      - Uses shadcn/ui Tabs component
      - Tab label includes agent icon (Lucide) + name
      - Active tab has colored underline matching agent color
  |
  [5] Each tab renders AgentLogTab:
      - Reads agentLogs from pipelineStore: agentLogs.get(taskId)?.[agentType]
      - If empty: show placeholder "Waiting for [Agent Name] to start..."
      - If has entries: render LogEntry components
  |
  [6] New content indicator:
      - When logs arrive on an inactive (not selected) tab:
        - Show small colored dot on the tab label
        - Dot clears when user switches to that tab
      - Tracked via local state: unreadTabs: Set<AgentType>
```

**Panel Context**:
- AgentLogPanel needs to know WHICH task's logs to show
- When TaskDetailView is open: show logs for that task
- When on the board page: show logs for the most recently active pipeline
- Tracked via `uiStore.activeLogTaskId` (set by TaskDetailView on mount, cleared on unmount)

---

## 6. Log Entry Rendering with Typing Effect

**Trigger**: pipelineStore.appendLog called by useSSE on "agent-log" event.

```
SSE event: agent-log { agent: "coder", chunk: "Implementing the user model...", timestamp: 1709001234567 }
  |
  [1] useSSE hook receives event
  [2] Dispatches: pipelineStore.appendLog(taskId, "coder", chunk, timestamp)
  |
  [3] agentLogs[taskId].coder array receives new LogEntry: { id, content: chunk, timestamp, isStreaming: true }
  |
  [4] AgentLogTab re-renders with new entry
  |
  [5] LogEntry component:
      - Renders timestamp prefix: [HH:MM:SS] in muted color
      - Renders content with typing effect (useTypingEffect hook)
      - Color: text color matches agent color (amber/blue/purple)
      - Font: monospace (font-mono)
  |
  [6] useTypingEffect hook:
      - Input: full text string, speed config
      - State: displayedText (progressively grows)
      - On mount / text change:
          - Start requestAnimationFrame loop
          - Each frame: append ~30 characters to displayedText
          - Interval: ~50ms between appends (via timestamp check in rAF)
          - When displayedText === fullText: mark isStreaming = false, stop loop
      - Shows blinking cursor at end while streaming
      - Cleanup: cancel rAF on unmount
  |
  [7] useAutoScroll hook:
      - Attached to AgentLogTab scroll container
      - On new LogEntry rendered:
          - Check if user is within 50px of bottom
          - If yes: scrollTo bottom (smooth)
          - If no: do NOT scroll (user is reading history)
      - Track isAtBottom state
      - If isAtBottom becomes false: show "Jump to latest" button
      - On tab switch: reset scroll to bottom, resume auto-scroll
```

**Streaming Batching**:
- SSE agent-log events arrive as small chunks (per Anthropic stream token)
- Multiple chunks may arrive in rapid succession
- LogEntry accumulates: if a new chunk arrives while previous is still typing, append to same entry (same continuous stream)
- New entry starts when: gap > 500ms between chunks OR agent changes

---

## 7. Panel Resize Behavior

**Component**: BottomDock with resize handle

```
BottomDock resize:
  |
  [1] Drag handle: horizontal bar at top of expanded panel
      - Cursor: row-resize
      - Visual: 4px wide, 40px horizontal grip line (centered)
  |
  [2] On drag start:
      - Record initial mouse Y and panel height
      - Add mousemove + mouseup listeners to document
  |
  [3] On drag move:
      - New height = initialHeight + (initialY - currentY)
      - Clamp: min 36px (collapsed), max 50vh
      - Apply height to panel via state
  |
  [4] On drag end:
      - Remove listeners
      - Store final height in uiStore.logPanelHeight for persistence
  |
  [5] Double-click on handle: toggle between collapsed (36px) and default (300px)
```

---

## 8. Task Detail Integration

**Updated**: `src/components/task/task-detail-view.tsx` (from UOW-03)

```
TaskDetailView mount:
  |
  [1] Set uiStore.activeLogTaskId = taskId
      (So AgentLogPanel knows which task's logs to display)
  |
  [2] Activate useSSE hook: useSSE({ taskId, enabled: true })
      (Establishes SSE connection for live updates)
  |
  [3] Fetch pipeline status on mount:
      GET /api/pipeline/[taskId]/status
      -> If active run exists: populate pipelineStore from response
      -> SSE will provide live updates going forward
  |
  [4] Render layout:
      - Top: PipelineVisualization (reads pipelineStore)
      - Middle: Task details (title, description, subtasks, etc.)
      - (UOW-06: DiffReviewPanel slot)
      - Bottom: AgentLogPanel in BottomDock (reads pipelineStore.agentLogs)
  |
  [5] On unmount:
      - Clear uiStore.activeLogTaskId
      - useSSE cleanup closes EventSource connection
```

**Updated Layout**:
```
+-----------------------------------------------------------+
| [<- Back to Board]                                         |
|                                                           |
| +-------------------------------------------------------+ |
| | [Spec] --> [Plan] --> [Code] --> [Review] --> [Done]   | |
| |  12s       8s        (01:23)    pending     pending    | |
| +-------------------------------------------------------+ |
|                                                           |
| +-------------------------------------------------------+ |
| | Fix login redirect bug                     [High]     | |
| | [Bug Fix]  Status: Building  Iteration: 1/3           | |
| +-------------------------------------------------------+ |
|                                                           |
| Description                                               |
| +-------------------------------------------------------+ |
| | The login page should redirect authenticated users ... | |
| +-------------------------------------------------------+ |
|                                                           |
| Subtasks (2/5)                                            |
| +-------------------------------------------------------+ |
| | [check] Create database migration                     | |
| | [check] Implement user registration endpoint          | |
| | [ ] Add registration form component                   | |
| | [ ] Write unit tests                                  | |
| | [ ] Add E2E test                                      | |
| +-------------------------------------------------------+ |
|                                                           |
| Pipeline Controls                                         |
| +-------------------------------------------------------+ |
| | [Cancel Pipeline]                                     | |
| +-------------------------------------------------------+ |
|                                                           |
+-----------------------------------------------------------+
|=== [resize handle] =======================================|
| [Planner] [Coder*] [Reviewer]          [collapse toggle] |
| --------------------------------------------------------- |
| [14:32:05] Implementing the user model...                 |
| [14:32:06] Creating file src/lib/db/schema.ts...         |
| [14:32:08] Generating migration script...                 |
| [14:32:10] Working on subtask 2: API routes...           |
|                                        [Jump to latest v] |
+-----------------------------------------------------------+
```

---

## 9. SSE Event Flow (UOW-05 Consumption)

**All SSE events are received by useSSE (defined in UOW-04) and dispatched to stores. UOW-05 components consume store state reactively.**

```
Server (PipelineOrchestrator)
  |
  |-- SSE event stream --> useSSE hook
                              |
         +--------------------+--------------------+
         |                    |                    |
         v                    v                    v
   pipelineStore         taskStore           Toast (Sonner)
   .updatePhase()       .updateTaskStatus()   on pipeline-complete
   .appendLog()                               on error
   .setError()
   .setComplete()
         |                    |
         v                    v
   PipelineVisualization   KanbanBoard
   (node states update)   (card auto-moves)
         |
         v
   AgentLogPanel
   (log entries stream in)
   (typing effect renders)
   (auto-scroll follows)
```

**Component-to-Store Reads**:

| Component | Store | Selector |
|-----------|-------|----------|
| PipelineVisualization | pipelineStore | `pipelineRuns.get(taskId)` -> phase, status |
| PipelineNode | pipelineStore | derived node status from pipeline phase |
| PipelineConnector | pipelineStore | derived fill state from pipeline phase |
| PipelineTimer | pipelineStore | `phaseTimings.get(taskId)` -> per-phase start/complete |
| AgentLogPanel | pipelineStore | `agentLogs.get(taskId)` |
| AgentLogTab | pipelineStore | `agentLogs.get(taskId)?.[agentType]` |
| LogEntry | (props) | receives individual log entry data |
| BottomDock | pipelineStore | any running pipeline (activity indicator) |
| BottomDock | uiStore | `logPanelHeight`, `isLogPanelExpanded` |

---

## 10. pipelineStore Extensions (UOW-05)

**Additions to pipelineStore (defined in UOW-04, extended here)**:

```
Extended State:
  phaseTimings: Map<string, PhaseTimingsMap>
    // key: taskId, value: Map<PipelinePhase, { startedAt: number, completedAt?: number }>

Extended Actions:
  updatePhase (modified):
    - In addition to UOW-04 behavior:
    - Record startedAt for new phase in phaseTimings
    - Record completedAt for previous phase in phaseTimings
    - Calculate duration for completed phase

New Selectors:
  getPhaseTimings(taskId: string): PhaseTimingsMap | null
  getActivePhaseTiming(taskId: string): { phase, elapsed } | null
```

**uiStore Extensions (UOW-05)**:

```
Extended State:
  activeLogTaskId: string | null      // which task's logs to show
  isLogPanelExpanded: boolean         // collapsed/expanded
  logPanelHeight: number              // current panel height in px (default: 300)

Extended Actions:
  setActiveLogTaskId(taskId: string | null): void
  toggleLogPanel(): void
  setLogPanelHeight(height: number): void
```

---

## Process-to-Story Traceability

| Business Process | Stories Covered |
|-----------------|----------------|
| Pipeline Visualization (5-node flow) | US-033 |
| Current Stage Pulse Animation | US-034 |
| Phase Timing Display | US-035 |
| Completed Stage Checkmark | US-036 |
| Log Panel Open/Collapse | US-037 |
| Agent Tab Switching | US-038 |
| Streaming Text Typing Effect | US-039 |
| Auto-Scroll Behavior | US-040 |
| Timestamps & Color Coding | US-041 |
