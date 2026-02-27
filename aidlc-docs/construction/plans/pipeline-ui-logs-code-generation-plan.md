# Code Generation Plan -- UOW-05: Pipeline UI & Agent Logs

## Overview

**Unit**: UOW-05 -- Pipeline UI & Agent Logs
**Stories**: US-033 through US-041 (9 stories: 5 Must, 4 Should)
**Dependencies**: UOW-01 (layout, BottomDock shell), UOW-04 (pipelineStore, useSSE, SSE events)
**Complexity**: Medium (purely frontend -- no new backend services or API routes)
**Tech**: React 19, Next.js 15 App Router, Framer Motion, shadcn/ui, Zustand, Tailwind CSS 4, Lucide React

This plan defines 16 numbered implementation steps for building the pipeline visualization, agent log panel, custom hooks, store extensions, integration wiring, and tests. Each step includes the target file(s), story traceability, business rule coverage, data-testid attributes, Framer Motion animation specifications, and testing notes.

---

## File Structure (All New/Updated Files)

```
src/
├── components/
│   ├── pipeline/
│   │   ├── pipeline-visualization.tsx    [NEW]
│   │   ├── pipeline-node.tsx             [NEW]
│   │   ├── pipeline-connector.tsx        [NEW]
│   │   └── pipeline-timer.tsx            [NEW]
│   ├── agent-log/
│   │   ├── agent-log-panel.tsx           [NEW]
│   │   ├── agent-log-tab.tsx             [NEW]
│   │   └── log-entry.tsx                 [NEW]
│   ├── layout/
│   │   └── bottom-dock.tsx               [UPDATED from UOW-01]
│   └── task/
│       └── task-detail-view.tsx          [UPDATED from UOW-03]
├── hooks/
│   ├── use-auto-scroll.ts               [NEW]
│   ├── use-typing-effect.ts             [NEW]
│   └── use-pipeline-visualization.ts    [NEW]
├── types/
│   ├── pipeline-ui.ts                   [NEW]
│   └── agent-log-ui.ts                  [NEW]
├── lib/
│   ├── constants/
│   │   └── pipeline-nodes.ts            [NEW]
│   └── validations/
│       └── pipeline-ui-schemas.ts       [NEW]
├── stores/
│   ├── pipeline-store.ts               [UPDATED -- extend phaseTimings, agentLogs V2]
│   └── ui-store.ts                     [UPDATED -- extend activeLogTaskId, logPanel state]
└── __tests__/
    ├── components/
    │   ├── pipeline/
    │   │   ├── pipeline-visualization.test.tsx  [NEW]
    │   │   ├── pipeline-node.test.tsx           [NEW]
    │   │   ├── pipeline-connector.test.tsx      [NEW]
    │   │   └── pipeline-timer.test.tsx          [NEW]
    │   └── agent-log/
    │       ├── agent-log-panel.test.tsx         [NEW]
    │       ├── agent-log-tab.test.tsx           [NEW]
    │       └── log-entry.test.tsx               [NEW]
    └── hooks/
        ├── use-auto-scroll.test.ts             [NEW]
        ├── use-typing-effect.test.ts           [NEW]
        └── use-pipeline-visualization.test.ts  [NEW]
```

---

## Step-by-Step Implementation Plan

---

### Step 1: Type Definitions

- [ ] **1.1** Create `src/types/pipeline-ui.ts`
- [ ] **1.2** Create `src/types/agent-log-ui.ts`
- [ ] **1.3** Create `src/lib/validations/pipeline-ui-schemas.ts`

**Files**:
- `src/types/pipeline-ui.ts` [NEW]
- `src/types/agent-log-ui.ts` [NEW]
- `src/lib/validations/pipeline-ui-schemas.ts` [NEW]

**Stories**: US-033, US-034, US-035, US-036, US-038, US-039, US-041 (type foundation for all pipeline + log features)

**Business Rules**: BR-05-001 (fixed 5-node layout), BR-05-002 (node status colors), BR-05-004 (phase timing format), BR-05-014 (log entry grouping threshold)

**Details**:

**1.1 -- `src/types/pipeline-ui.ts`**:
```ts
// Types to define:
VisualizationNodePhase = "spec" | "plan" | "code" | "review" | "done"
NodeStatus = "pending" | "active" | "completed" | "failed"
ConnectorStatus = "empty" | "filling" | "filled"

interface PipelineNodeState {
  phase: VisualizationNodePhase;
  status: NodeStatus;
  startedAt?: number;
  completedAt?: number;
  duration?: number;
}

interface PipelineNodeConfig {
  phase: VisualizationNodePhase;
  label: string;
  icon: string;            // Lucide icon name
  serverPhases: PipelinePhase[];  // maps to server phase(s) that activate this node
}

interface PhaseTiming {
  startedAt: number;
  completedAt?: number;
  duration?: number;
}

type PhaseTimingsMap = Partial<Record<VisualizationNodePhase, PhaseTiming>>

interface NodeColorScheme {
  border: string;    // hex
  bg: string;        // Tailwind class
  text: string;      // Tailwind class
  glow: string;      // rgba for pulse shadow
}

// Color maps:
NODE_STATUS_COLORS: Record<NodeStatus, NodeColorScheme>
  - pending: gray (#6B7280)
  - active: empty (overridden by phase-specific)
  - completed: green (#22C55E)
  - failed: red (#EF4444)

ACTIVE_PHASE_COLORS: Record<string, NodeColorScheme>
  - planning: amber (#F59E0B)
  - coding: blue (#3B82F6)
  - fixing: blue (#3B82F6)
  - reviewing: purple (#8B5CF6)
  - completed: green (#22C55E)
```

**1.2 -- `src/types/agent-log-ui.ts`**:
```ts
interface LogEntry {
  id: string;
  agentType: AgentType;
  content: string;
  timestamp: number;
  isStreaming: boolean;
}

interface AgentTab {
  type: AgentType;
  label: string;
  color: string;    // hex accent
  icon: string;     // Lucide icon name
}

// Constants:
AGENT_TABS: AgentTab[] = [
  { type: "planner", label: "Planner", color: "#F59E0B", icon: "Brain" },
  { type: "coder",   label: "Coder",   color: "#3B82F6", icon: "Code2" },
  { type: "reviewer", label: "Reviewer", color: "#8B5CF6", icon: "Search" },
]

AGENT_TAB_COLORS: Record<AgentType, string>

// Store extension types:
interface AgentLogsStateV2 {
  planner: LogEntry[];
  coder: LogEntry[];
  reviewer: LogEntry[];
}

interface PipelineStoreExtensions {
  phaseTimings: Map<string, PhaseTimingsMap>;
}

interface UIStoreExtensions {
  activeLogTaskId: string | null;
  isLogPanelExpanded: boolean;
  logPanelHeight: number;
}

// Hook return types:
interface UseAutoScrollReturn { scrollRef, isAtBottom, scrollToBottom }
interface UseTypingEffectOptions { text, charsPerFrame?, frameInterval?, enabled? }
interface UseTypingEffectReturn { displayedText, isTyping }
interface UsePipelineVisualizationReturn { nodes: PipelineNodeState[], isActive, iteration }
```

**1.3 -- `src/lib/validations/pipeline-ui-schemas.ts`**:
- Zod schemas for all runtime validation:
  - `visualizationNodePhaseSchema` (enum: spec/plan/code/review/done)
  - `nodeStatusSchema` (enum: pending/active/completed/failed)
  - `connectorStatusSchema` (enum: empty/filling/filled)
  - `phaseTimingSchema` (startedAt: positive int, completedAt?: positive int, duration?: nonneg int)
  - `pipelineNodeStateSchema` (composite)
  - `logEntrySchema` (id, agentType enum, content, timestamp, isStreaming)
  - `appendLogInputSchema` (taskId, agent, chunk, timestamp) -- validates SSE dispatch input
  - `phaseUpdateInputSchema` (taskId, phase, status, iteration, timestamp) -- validates SSE dispatch input
  - `logPanelHeightSchema` (int, min 36, max 1080, default 300)
  - Inferred types exported for each schema

**Testing Notes**:
- Unit test Zod schemas with valid/invalid inputs
- Verify `PIPELINE_NODES` has exactly 5 entries
- Verify `AGENT_TABS` has exactly 3 entries with correct color assignments
- Verify `NODE_STATUS_COLORS` covers all 4 NodeStatus values

---

### Step 2: Constants

- [ ] **2.1** Create `src/lib/constants/pipeline-nodes.ts`

**File**: `src/lib/constants/pipeline-nodes.ts` [NEW]

**Stories**: US-033 (5-node layout), US-034 (pulse colors), US-035 (timing constants), US-037 (panel dimensions), US-039 (typing speed), US-040 (scroll threshold), US-041 (log grouping)

**Business Rules**: BR-05-001, BR-05-002, BR-05-004, BR-05-007, BR-05-008, BR-05-012, BR-05-014

**Details**:
```ts
// Re-export PIPELINE_NODES from types/pipeline-ui.ts (or define here and import in types)

// Pipeline visualization:
PIPELINE_NODES (5 items, defined in types/pipeline-ui.ts, re-exported here for convenience)

// Animation constants (NFR-05-024: centralized, no magic numbers):
PULSE_ANIMATION_DURATION = 2          // seconds, infinite repeat
PULSE_SCALE_RANGE = [1, 1.05, 1]
PULSE_GLOW_SIZE = 8                   // px
CONNECTOR_FILL_DURATION = 0.8         // seconds, easeOut
PANEL_SPRING_STIFFNESS = 300
PANEL_SPRING_DAMPING = 30
ICON_SWAP_DURATION = 0.2              // seconds
BORDER_TRANSITION_DURATION = 0.3      // seconds
NODE_PENDING_OPACITY = 0.5

// Panel dimensions (BR-05-008):
LOG_PANEL_COLLAPSED_HEIGHT = 36       // px
LOG_PANEL_DEFAULT_HEIGHT = 300        // px
LOG_PANEL_MAX_HEIGHT_VH = 50          // vh (50% viewport)

// Typing effect (BR-05-012):
TYPING_CHARS_PER_FRAME = 30
TYPING_FRAME_INTERVAL_MS = 50
TYPING_DEGRADATION_THRESHOLD_MS = 32  // frame budget for graceful degradation
TYPING_DEGRADATION_CHARS = 50         // bulk chars when degrading

// Auto-scroll (BR-05-007):
AUTO_SCROLL_THRESHOLD_PX = 50

// Log entry grouping (BR-05-014):
LOG_ENTRY_GROUP_THRESHOLD_MS = 500

// Log buffer cap (NFR-05-011):
LOG_BUFFER_MAX_ENTRIES = 10_000

// Unread indicator dot size:
UNREAD_DOT_SIZE_PX = 6               // 1.5 in Tailwind (w-1.5 h-1.5)

// Responsive breakpoints (NFR-05-019):
PIPELINE_NODE_SIZE_DESKTOP = 48       // px (h-12 w-12)
PIPELINE_NODE_SIZE_TABLET = 40        // px (h-10 w-10)
PIPELINE_NODE_SIZE_MOBILE = 32        // px (h-8 w-8)
CONNECTOR_WIDTH_DESKTOP = 48          // px
CONNECTOR_WIDTH_TABLET = 32           // px
CONNECTOR_WIDTH_MOBILE = 24           // px
```

**Testing Notes**:
- Verify all constants are exported as named exports
- Verify `LOG_PANEL_COLLAPSED_HEIGHT` < `LOG_PANEL_DEFAULT_HEIGHT`
- Verify `TYPING_CHARS_PER_FRAME` > 0, `TYPING_FRAME_INTERVAL_MS` > 0

---

### Step 3: usePipelineVisualization Hook

- [ ] **3.1** Create `src/hooks/use-pipeline-visualization.ts`

**File**: `src/hooks/use-pipeline-visualization.ts` [NEW]

**Stories**: US-033 (derive 5-node states), US-034 (identify active node), US-036 (completed nodes)

**Business Rules**: BR-05-001 (fixed 5-node layout), BR-05-003 (single active node constraint)

**Details**:
- Reads `pipelineStore.pipelineRuns.get(taskId)` and `pipelineStore.phaseTimings.get(taskId)`
- Returns `{ nodes: PipelineNodeState[], isActive: boolean, iteration: number }`
- `nodes` is always exactly 5 items (one per PIPELINE_NODES config)
- Core logic: `deriveNodeStatus(config, pipelineRun) -> NodeStatus`
  - If no pipelineRun: all nodes "pending"
  - Find activeIndex by matching `pipelineRun.phase` to `serverPhases` in PIPELINE_NODES
  - Special case for "plan" node (has no direct serverPhases): completes when activeIndex moves past it
  - Nodes before activeIndex: "completed"
  - Node at activeIndex: "active"
  - Nodes after activeIndex: "pending"
  - If pipeline failed: node at activeIndex = "failed"
  - If pipeline cancelled: all "pending" (reset visual)
- Uses `useMemo` for derived `nodes` array (memoized on pipelineRun + phaseTimings)
- Zustand selector equality: only re-computes when phase or timing actually changes

**Phase-to-Node Mapping Table** (from business-logic-model):

| Server Phase | Active Node | Completed Nodes |
|-------------|-------------|-----------------|
| planning | Spec | (none) |
| coding | Code | Spec, Plan |
| reviewing | Review | Spec, Plan, Code |
| fixing | Code (re-activates, iteration badge) | Spec, Plan |
| completed | Done | Spec, Plan, Code, Review |
| failed | (failed node) | all before it |
| cancelled | (all pending) | (none) |

**NFR Coverage**: NFR-05-005 (render time < 100ms mount, < 50ms re-render via useMemo)

**Testing Notes**:
- Test with pipelineRun = undefined -> all 5 nodes "pending"
- Test each server phase -> correct node statuses
- Test failed at "reviewing" -> Review = "failed", Spec/Plan/Code = "completed", Done = "pending"
- Test cancelled -> all "pending"
- Test "fixing" phase -> Code re-activates, Plan still "completed"
- Verify exactly 1 "active" node at any time (BR-05-003)
- Verify returned `nodes` array always has exactly 5 elements

---

### Step 4: PipelineVisualization Container

- [ ] **4.1** Create `src/components/pipeline/pipeline-visualization.tsx`

**File**: `src/components/pipeline/pipeline-visualization.tsx` [NEW]

**Stories**: US-033 (view 5-stage pipeline)

**Business Rules**: BR-05-001 (fixed 5-node layout), BR-05-003 (single active constraint)

**Props**:
```ts
interface PipelineVisualizationProps {
  taskId: string;
}
```

**Details**:
- `"use client"` directive (client component)
- Calls `usePipelineVisualization({ taskId })` to get `{ nodes, isActive, iteration }`
- Renders horizontal flex row: `<div className="flex items-center justify-between gap-0 px-4 py-6">`
- Maps over `nodes` array:
  - Render `<PipelineNode>` for each node
  - Render `<PipelineConnector>` between each pair (4 connectors total)
  - Wrap in `<Fragment key={node.phase}>`
- Connector status derived inline: `deriveConnectorStatus(nodes[i], nodes[i+1])`
  - rightNode "completed" or "failed" -> "filled"
  - rightNode "active" -> "filling"
  - rightNode "pending" -> "empty"
- Connector color derived from right node's phase color
- Responsive: desktop full labels, mobile icon-only (`md:` breakpoint for label visibility)
- No direct Framer Motion on container (individual children animate themselves)

**data-testid Attributes**:
- `data-testid="pipeline-visualization"` on container div
- `data-testid="pipeline-node-{phase}"` on each PipelineNode wrapper (e.g., `pipeline-node-spec`)
- `data-testid="pipeline-connector-{index}"` on each connector (0-3)

**NFR Coverage**: NFR-05-005 (< 100ms mount), NFR-05-019 (responsive), NFR-05-022 (container reads store, children get props only)

**Testing Notes**:
- Render with mock pipelineStore -> 5 nodes + 4 connectors present
- Verify `data-testid` attributes exist for all nodes/connectors
- Verify horizontal layout (flex row)
- Test responsive: at mobile viewport, labels hidden

---

### Step 5: PipelineNode Component

- [ ] **5.1** Create `src/components/pipeline/pipeline-node.tsx`

**File**: `src/components/pipeline/pipeline-node.tsx` [NEW]

**Stories**: US-033 (node display), US-034 (active pulse), US-036 (completed checkmark)

**Business Rules**: BR-05-002 (status colors), BR-05-003 (single active), BR-05-005 (completed checkmark + failed X icon)

**Props**:
```ts
interface PipelineNodeProps {
  config: PipelineNodeConfig;
  state: PipelineNodeState;
  isActive: boolean;
}
```

**Details**:
- `"use client"` directive
- Pure display component -- no store reads (NFR-05-022)
- Resolves colors via `getNodeColors(state.status, pipelinePhase)`:
  - pending -> `NODE_STATUS_COLORS.pending`
  - active -> `ACTIVE_PHASE_COLORS[currentServerPhase]`
  - completed -> `NODE_STATUS_COLORS.completed`
  - failed -> `NODE_STATUS_COLORS.failed`
- Resolves icon:
  - pending/active: use `config.icon` (FileText, ListChecks, Code2, Search, CheckCircle2)
  - completed: `CheckCircle2` (green)
  - failed: `XCircle` (red)
- Layout: vertical column (icon circle + label + timer)
  - Circle: `h-12 w-12 rounded-full border-2`
  - Label: `text-xs font-medium` (hidden on mobile: `hidden md:block`)
  - `<PipelineTimer>` below label

**Framer Motion Animations**:

Active Pulse (BR-05-002, US-034):
```ts
// On the circle container:
animate={isActive ? {
  scale: [1, 1.05, 1],
  boxShadow: [
    `0 0 0 0 ${colors.glow}`,
    `0 0 0 8px ${colors.glow}`,
    `0 0 0 0 ${colors.glow}`,
  ],
} : { scale: 1, boxShadow: "none" }}
transition={isActive ? {
  duration: PULSE_ANIMATION_DURATION,      // 2s
  repeat: Infinity,
  ease: "easeInOut",
} : { duration: BORDER_TRANSITION_DURATION }}  // 0.3s
```

Icon Swap (BR-05-005, US-036):
```tsx
<AnimatePresence mode="wait">
  <motion.div
    key={state.status}                   // triggers re-mount on status change
    initial={{ scale: 0.5, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    exit={{ scale: 0.5, opacity: 0 }}
    transition={{ duration: ICON_SWAP_DURATION }}  // 0.2s
  >
    <ResolvedIcon className={cn("h-5 w-5", colors.text)} />
  </motion.div>
</AnimatePresence>
```

Border Color Transition:
```tsx
<motion.div
  animate={{ borderColor: colors.border }}
  transition={{ duration: BORDER_TRANSITION_DURATION }}  // 0.3s
/>
```

Pending Opacity:
```tsx
// Pending nodes: opacity 0.5
<motion.div
  animate={{ opacity: state.status === "pending" ? NODE_PENDING_OPACITY : 1 }}
  transition={{ duration: 0.3 }}
/>
```

**data-testid Attributes**:
- `data-testid="pipeline-node"` on root container
- `data-testid="pipeline-node-circle"` on the animated circle
- `data-testid="pipeline-node-icon"` on the icon wrapper
- `data-testid="pipeline-node-label"` on the label span

**Testing Notes**:
- Render each status variant: pending, active, completed, failed
- Verify correct icon: pending -> default, completed -> CheckCircle2, failed -> XCircle
- Verify active state has `Infinity` repeat animation (check motion props)
- Verify correct Tailwind color classes per status
- Verify label is hidden on mobile (check `hidden md:block` class)
- Verify no store imports in this file (NFR-05-022)

---

### Step 6: PipelineConnector Component

- [ ] **6.1** Create `src/components/pipeline/pipeline-connector.tsx`

**File**: `src/components/pipeline/pipeline-connector.tsx` [NEW]

**Stories**: US-033 (connecting lines between nodes)

**Business Rules**: BR-05-002 (connector colors match phase)

**Props**:
```ts
interface PipelineConnectorProps {
  status: ConnectorStatus;   // "empty" | "filling" | "filled"
  color: string;             // hex color for fill bar
}
```

**Details**:
- `"use client"` directive
- Pure display component -- no store reads (NFR-05-022)
- Track (background): `bg-muted`, 2px height, flex-1 width
- Fill (foreground): animated bar inside track, colored by `color` prop
- Layout: `<div className="relative flex-1 h-0.5 bg-muted mx-1">` with absolute fill child

**Framer Motion Animation**:
```tsx
<motion.div
  className="absolute inset-y-0 left-0 h-full rounded-full"
  style={{ backgroundColor: color }}
  initial={{ width: "0%" }}
  animate={{
    width: status === "filled" ? "100%" :
           status === "filling" ? "100%" :
           "0%"
  }}
  transition={
    status === "filling"
      ? { duration: CONNECTOR_FILL_DURATION, ease: "easeOut" }  // 0.8s
      : { duration: 0.3 }
  }
/>
```

**Status Behavior**:
- `empty`: gray track, no fill (width 0%)
- `filling`: animated fill from 0% to 100% over 0.8s (easeOut)
- `filled`: instant fill to 100% (0.3s transition)

**data-testid Attributes**:
- `data-testid="pipeline-connector"` on track container
- `data-testid="pipeline-connector-fill"` on animated fill bar

**Testing Notes**:
- Render "empty" -> fill bar at width 0%
- Render "filled" -> fill bar at width 100%
- Render "filling" -> fill bar animating to 100%
- Verify fill bar color matches `color` prop
- Verify no store imports (NFR-05-022)

---

### Step 7: PipelineTimer Component

- [ ] **7.1** Create `src/components/pipeline/pipeline-timer.tsx`

**File**: `src/components/pipeline/pipeline-timer.tsx` [NEW]

**Stories**: US-035 (phase timing display)

**Business Rules**: BR-05-004 (timing format rules)

**Props**:
```ts
interface PipelineTimerProps {
  phase: VisualizationNodePhase;
  state: PipelineNodeState;
}
```

**Details**:
- `"use client"` directive
- Pure display component -- no store reads (NFR-05-022)
- Internal state: `elapsed: number` (ms, for live timer)
- Timer logic:
  - `useEffect` with `setInterval(1000)` when `state.status === "active"` and `state.startedAt` exists
  - On each tick: `setElapsed(Date.now() - state.startedAt)`
  - Cleanup: `clearInterval` on unmount or status change
- Render logic:
  - `pending` -> return `null` (hidden)
  - `active` with `startedAt` -> live timer: `formatElapsed(elapsed)` = MM:SS
  - `completed` with `duration` -> static: `formatDuration(duration)` = Xs or M:SS
  - `failed` with `duration` -> static in red: `formatDuration(duration)`
- Format functions:
  - `formatElapsed(ms)`: `MM:SS` with leading zeros (e.g., "00:05", "01:23")
  - `formatDuration(ms)`: `Xs` for <60s (e.g., "12s"), `M:SS` for >=60s (e.g., "1:45")
- Styling: `text-[10px] text-muted-foreground tabular-nums` (failed: `text-red-500`)

**data-testid Attributes**:
- `data-testid="pipeline-timer"` on the timer span
- `data-testid="pipeline-timer-active"` when showing live timer
- `data-testid="pipeline-timer-completed"` when showing static duration

**Testing Notes**:
- Render pending -> no output
- Render active with startedAt=now-5000 -> shows "00:05", ticks to "00:06" after 1s
- Render completed with duration=12000 -> shows "12s"
- Render completed with duration=105000 -> shows "1:45"
- Render failed with duration=30000 -> shows "30s" in red
- Use `jest.useFakeTimers()` for interval testing
- Verify interval cleanup on unmount (no memory leak)

---

### Step 8: useAutoScroll Hook

- [ ] **8.1** Create `src/hooks/use-auto-scroll.ts`

**File**: `src/hooks/use-auto-scroll.ts` [NEW]

**Stories**: US-040 (auto-scroll with manual override)

**Business Rules**: BR-05-007 (50px threshold, pause/resume, "Jump to latest")

**Returns**:
```ts
interface UseAutoScrollReturn {
  scrollRef: React.RefObject<HTMLDivElement>;
  isAtBottom: boolean;
  scrollToBottom: () => void;
}
```

**Details**:
- Internal state: `isAtBottom: boolean` (default `true`)
- Scroll position tracking via `scroll` event listener on `scrollRef.current`:
  - `distanceFromBottom = scrollHeight - scrollTop - clientHeight`
  - `isAtBottom = distanceFromBottom <= AUTO_SCROLL_THRESHOLD_PX` (50px)
  - Listener uses `{ passive: true }` to prevent scroll jank
- Auto-scroll via `MutationObserver` on scroll container:
  - Observes `{ childList: true, subtree: true, characterData: true }`
  - On mutation: if `isAtBottom`, scroll to bottom with `behavior: "smooth"`
  - Only active when `isAtBottom === true` (paused when user scrolls up)
  - Disconnects/reconnects based on `isAtBottom` state change
- `scrollToBottom()`: programmatically scroll to bottom + set `isAtBottom = true`
  - Used by "Jump to latest" button and tab switch reset

**NFR Coverage**: NFR-05-015 (auto-scroll UX), NFR-05-006 (no layout shifts)

**data-testid Attributes**: N/A (hook, not component -- but scroll container in AgentLogTab will have `data-testid="agent-log-scroll-container"`)

**Testing Notes**:
- Mock scrollable div with adjustable scrollHeight/scrollTop/clientHeight
- Verify `isAtBottom` starts as `true`
- Simulate scroll up beyond 50px -> `isAtBottom` becomes `false`
- Simulate scroll back to bottom -> `isAtBottom` becomes `true`
- Verify `scrollToBottom()` sets `isAtBottom = true` and calls `scrollTo`
- Verify MutationObserver disconnects when `isAtBottom = false`
- Use `renderHook` from `@testing-library/react-hooks`

---

### Step 9: useTypingEffect Hook

- [ ] **9.1** Create `src/hooks/use-typing-effect.ts`

**File**: `src/hooks/use-typing-effect.ts` [NEW]

**Stories**: US-039 (streaming text typing effect)

**Business Rules**: BR-05-012 (30 chars per frame at 50ms), BR-05-013 (blinking cursor while streaming)

**Parameters**:
```ts
interface UseTypingEffectOptions {
  text: string;
  charsPerFrame?: number;    // default: TYPING_CHARS_PER_FRAME (30)
  frameInterval?: number;    // default: TYPING_FRAME_INTERVAL_MS (50ms)
  enabled?: boolean;         // default: true
}
```

**Returns**:
```ts
interface UseTypingEffectReturn {
  displayedText: string;
  isTyping: boolean;
}
```

**Details**:
- When `enabled = false`: `displayedText = text` immediately, `isTyping = false`
- When `enabled = true`:
  - Uses `requestAnimationFrame` loop (not setInterval)
  - Tracks `indexRef` (current position), `lastTimeRef` (last append timestamp), `rafRef` (animation frame ID)
  - Each rAF callback: check if `>= frameInterval` elapsed since last append
  - If yes: append `charsPerFrame` characters to displayed text via `setDisplayedText(text.slice(0, nextIndex))`
  - When `nextIndex >= text.length`: set `isTyping = false`, stop rAF loop
  - Graceful degradation (NFR-05-014): if frame delta > `TYPING_DEGRADATION_THRESHOLD_MS` (32ms), use `TYPING_DEGRADATION_CHARS` (50) instead of 30
- When `text` prop grows (chunk appended to existing entry): continue typing from current position (no restart)
  - If `indexRef.current > text.length`: reset to 0 (text was replaced entirely)
- Cleanup: `cancelAnimationFrame(rafRef.current)` on unmount

**NFR Coverage**: NFR-05-004 (<= 20 re-renders/sec), NFR-05-014 (graceful degradation)

**Testing Notes**:
- Test with `enabled = false` -> displayedText equals full text immediately
- Test with `enabled = true`, short text -> types out progressively, isTyping true then false
- Test text growth (append) -> continues from current position
- Test `charsPerFrame` / `frameInterval` params respected
- Use `jest.useFakeTimers()` + manual rAF invocation
- Verify rAF is cancelled on unmount (no memory leak)

---

### Step 10: AgentLogPanel Component

- [ ] **10.1** Create `src/components/agent-log/agent-log-panel.tsx`

**File**: `src/components/agent-log/agent-log-panel.tsx` [NEW]

**Stories**: US-037 (log panel open/collapse -- partial, panel content), US-038 (agent tab switching), US-041 (color coding)

**Business Rules**: BR-05-006 (agent tab colors), BR-05-010 (empty tab placeholder), BR-05-015 (unread tab indicator)

**Props**: None (reads from stores)

**Details**:
- `"use client"` directive
- Reads from stores:
  - `uiStore.activeLogTaskId` -> which task's logs to show
  - `pipelineStore.agentLogs.get(activeLogTaskId)` -> agent log data
  - `pipelineStore.pipelineRuns.get(activeLogTaskId)` -> pipeline status (for `isActive` prop)
- Local state:
  - `activeTab: AgentType` (default: "planner")
  - `unreadTabs: Set<AgentType>` (tracks tabs with new content while not selected)
- Unread tracking (BR-05-015):
  - `useEffect` watches `agentLogs` changes
  - For each non-active tab: if log length increased since last check, add to `unreadTabs`
  - On tab switch: remove selected tab from `unreadTabs`
  - Uses `prevLengthRef: { planner: number, coder: number, reviewer: number }` to track previous lengths
- Uses shadcn/ui `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`
- Tab rendering:
  - Each tab shows: Lucide icon + label + optional unread dot
  - Unread dot: `w-1.5 h-1.5 rounded-full` positioned top-right, colored by `tab.color`
  - Tab active underline: colored by `tab.color` via CSS custom property `--tab-active-color`
  - Mobile: icon only (`hidden sm:inline` on label text)
- Tab content: renders `<AgentLogTab>` for each agent type
- Empty state messages (BR-05-010):
  - No taskId: "No logs yet -- start a pipeline to see agent output."
  - Has taskId but no logs: "Waiting for {label} to start..."

**data-testid Attributes**:
- `data-testid="agent-log-panel"` on root Tabs container
- `data-testid="agent-tab-{type}"` on each TabsTrigger (e.g., `agent-tab-planner`)
- `data-testid="agent-tab-content-{type}"` on each TabsContent
- `data-testid="agent-tab-unread-dot-{type}"` on unread indicator dots

**Testing Notes**:
- Render with no taskId -> shows "No logs yet" message
- Render with taskId, empty logs -> shows "Waiting for Planner to start..."
- Render with logs on coder tab while planner selected -> unread dot appears on coder tab
- Switch to coder tab -> unread dot clears
- Verify 3 tabs always rendered (Planner, Coder, Reviewer)
- Verify tab colors match AGENT_TABS config

---

### Step 11: AgentLogTab Component

- [ ] **11.1** Create `src/components/agent-log/agent-log-tab.tsx`

**File**: `src/components/agent-log/agent-log-tab.tsx` [NEW]

**Stories**: US-038 (tab content display), US-040 (auto-scroll + "Jump to latest"), US-041 (monospace styling)

**Business Rules**: BR-05-007 (auto-scroll 50px threshold), BR-05-010 (empty state placeholder), BR-05-017 (monospace font)

**Props**:
```ts
interface AgentLogTabProps {
  agentType: AgentType;
  logs: LogEntry[];
  color: string;
  isActive: boolean;
  emptyMessage: string;
}
```

**Details**:
- `"use client"` directive
- Uses `useAutoScroll()` hook -> `{ scrollRef, isAtBottom, scrollToBottom }`
- Empty state: centered `emptyMessage` in `text-sm text-muted-foreground`
- Non-empty: scrollable container with log entries
  - Container: `ref={scrollRef}`, `overflow-y-auto scroll-smooth px-3 py-2 font-mono text-sm leading-relaxed`
  - Maps `logs` to `<LogEntry>` components
- "Jump to latest" button (BR-05-007):
  - Shown when `!isAtBottom`
  - Position: `absolute bottom-2 right-3`
  - Style: `rounded-full bg-background/80 px-3 py-1 text-xs shadow-md backdrop-blur-sm border`
  - Content: "Jump to latest" + `<ArrowDown className="h-3 w-3" />`
  - onClick: `scrollToBottom()`
- CSS optimization (NFR-05-003, tech-stack-decisions):
  - `.log-entry { content-visibility: auto; contain-intrinsic-size: 0 24px; }` for native browser optimization

**data-testid Attributes**:
- `data-testid="agent-log-tab"` on root container
- `data-testid="agent-log-scroll-container"` on scrollable div
- `data-testid="agent-log-empty"` on empty state div
- `data-testid="jump-to-latest"` on "Jump to latest" button

**Testing Notes**:
- Render with empty logs -> empty state message shown, no scroll container
- Render with logs -> log entries rendered in scroll container
- Verify `font-mono` class on scroll container (BR-05-017)
- Verify "Jump to latest" button appears when scrolled up
- Verify "Jump to latest" button hidden when at bottom
- Verify clicking "Jump to latest" calls `scrollToBottom()`

---

### Step 12: LogEntry Component

- [ ] **12.1** Create `src/components/agent-log/log-entry.tsx`
- [ ] **12.2** Add `.animate-blink` CSS keyframes to global styles

**Files**:
- `src/components/agent-log/log-entry.tsx` [NEW]
- `src/app/globals.css` [UPDATED -- add blink keyframe]

**Stories**: US-039 (typing effect), US-041 (timestamps + color coding)

**Business Rules**: BR-05-009 (HH:MM:SS timestamp), BR-05-012 (typing speed), BR-05-013 (blinking cursor), BR-05-017 (monospace font)

**Props**:
```ts
interface LogEntryProps {
  entry: LogEntry;
  color: string;      // hex color for text
}
```

**Details**:
- `"use client"` directive
- Uses `useTypingEffect({ text: entry.content, enabled: entry.isStreaming })`:
  - When `isStreaming = true`: typing effect active, shows `displayedText`
  - When `isStreaming = false`: shows full `entry.content` immediately (no animation)
- Timestamp formatting (BR-05-009):
  - `new Date(entry.timestamp).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })`
  - Rendered as `[HH:MM:SS]` prefix in `text-muted-foreground`
- Layout: `flex gap-2 py-0.5`
  - Timestamp: `shrink-0 select-none text-muted-foreground`
  - Content: text colored by `color` prop (inline `style={{ color }}`)
- Blinking cursor (BR-05-013):
  - Shown when `isTyping === true`
  - Character: `|`
  - CSS class: `animate-blink ml-px`
  - Color matches agent color (inline style)
- Content is rendered via JSX text interpolation (`{displayedText}`) -- NO `dangerouslySetInnerHTML` (NFR-05-007 XSS prevention)

**12.2 -- CSS Keyframe** (add to `globals.css`):
```css
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
.animate-blink {
  animation: blink 1s step-end infinite;
}
```

**data-testid Attributes**:
- `data-testid="log-entry"` on root div
- `data-testid="log-entry-timestamp"` on timestamp span
- `data-testid="log-entry-content"` on content span
- `data-testid="log-entry-cursor"` on blinking cursor span (when visible)

**Testing Notes**:
- Render with `isStreaming = false` -> full content shown immediately, no cursor
- Render with `isStreaming = true` -> typing effect active, cursor visible
- Verify timestamp format matches `[HH:MM:SS]` pattern
- Verify content color matches `color` prop
- Verify cursor has `animate-blink` class
- Inject XSS payload as `entry.content` -> verify renders as literal text (NFR-05-007)
  - Test payloads: `<script>alert('xss')</script>`, `<img onerror="alert(1)" src=x>`

---

### Step 13: Update BottomDock

- [ ] **13.1** Update `src/components/layout/bottom-dock.tsx` with collapse/expand, resize, and AgentLogPanel integration
- [ ] **13.2** Extend `src/stores/ui-store.ts` with log panel state

**Files**:
- `src/components/layout/bottom-dock.tsx` [UPDATED]
- `src/stores/ui-store.ts` [UPDATED]

**Stories**: US-037 (open/collapse log panel)

**Business Rules**: BR-05-008 (height constraints: 36px min, 50vh max, 300px default), BR-05-011 (resize via drag), BR-05-016 (activity indicator on collapsed panel)

**13.1 -- BottomDock Updates**:
- Reads from `uiStore`:
  - `isLogPanelExpanded` (boolean)
  - `logPanelHeight` (number, px)
  - `toggleLogPanel()` (action)
  - `setLogPanelHeight(height)` (action)
- Reads from `pipelineStore`:
  - `hasRunningPipeline` = any pipelineRun with status "running"
- Structure:
  - `<motion.div>` with animated height (spring transition)
  - Resize handle: visible only when expanded
    - `h-2 cursor-row-resize` with centered grip line (`h-1 w-10 rounded-full bg-muted-foreground/30`)
    - `onMouseDown={handleResizeStart}` for drag
    - `onDoubleClick={togglePanel}` to toggle collapsed/expanded
  - Toggle bar: always visible (36px)
    - Label: "Agent Logs" (`text-xs font-medium text-muted-foreground`)
    - Activity indicator: `PulseDot` (from UOW-03) when collapsed + running pipeline
    - Toggle button: ChevronDown (when expanded) / ChevronUp (when collapsed)
    - aria-label: "Collapse log panel" / "Expand log panel"
  - Content area: `<AgentLogPanel />` (only when expanded)
    - Height: `panelHeight - LOG_PANEL_COLLAPSED_HEIGHT - 8` (account for resize handle + toggle bar)

**Resize Handler**:
```ts
const handleResizeStart = useCallback((e: React.MouseEvent) => {
  e.preventDefault();
  const startY = e.clientY;
  const startHeight = panelHeight;

  const handleMouseMove = (e: MouseEvent) => {
    const delta = startY - e.clientY;
    const newHeight = Math.max(
      LOG_PANEL_COLLAPSED_HEIGHT,
      Math.min(window.innerHeight * (LOG_PANEL_MAX_HEIGHT_VH / 100), startHeight + delta)
    );
    setPanelHeight(newHeight);
  };

  const handleMouseUp = () => {
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };

  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", handleMouseUp);
}, [panelHeight, setPanelHeight]);
```

**Framer Motion -- Panel Height**:
```tsx
<motion.div
  className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background"
  animate={{ height: isExpanded ? panelHeight : LOG_PANEL_COLLAPSED_HEIGHT }}
  transition={{
    type: "spring",
    stiffness: PANEL_SPRING_STIFFNESS,   // 300
    damping: PANEL_SPRING_DAMPING,        // 30
  }}
/>
```

**13.2 -- uiStore Extensions**:
```ts
// Add to uiStore state:
activeLogTaskId: string | null;       // default: null
isLogPanelExpanded: boolean;          // default: false
logPanelHeight: number;               // default: LOG_PANEL_DEFAULT_HEIGHT (300)

// Add to uiStore actions:
setActiveLogTaskId(taskId: string | null): void;
toggleLogPanel(): void;               // flip isLogPanelExpanded, if collapsing reset to default
setLogPanelHeight(height: number): void;  // validates with logPanelHeightSchema
```

**data-testid Attributes**:
- `data-testid="bottom-dock"` on root motion.div
- `data-testid="bottom-dock-resize-handle"` on resize grip area
- `data-testid="bottom-dock-toggle-bar"` on toggle bar div
- `data-testid="bottom-dock-toggle-button"` on expand/collapse button
- `data-testid="bottom-dock-activity-indicator"` on PulseDot wrapper
- `data-testid="bottom-dock-content"` on content area wrapper

**Testing Notes**:
- Render collapsed -> height = 36px, no content visible, toggle button shows ChevronUp
- Click toggle -> expanded, height = 300px, content visible, toggle shows ChevronDown
- Double-click resize handle -> toggles between collapsed and expanded
- Verify activity indicator visible when collapsed + pipeline running
- Verify activity indicator hidden when expanded or no pipeline running
- Test resize drag: mock mousedown/mousemove/mouseup -> panel height updates
- Test height clamping: drag below 36px -> stays at 36px; drag above 50vh -> clamped
- Verify Escape key collapses panel (NFR-05-020)

---

### Step 14: Update TaskDetailView

- [ ] **14.1** Update `src/components/task/task-detail-view.tsx` to integrate PipelineVisualization and wire useSSE
- [ ] **14.2** Extend `src/stores/pipeline-store.ts` with phaseTimings and agentLogs V2

**Files**:
- `src/components/task/task-detail-view.tsx` [UPDATED]
- `src/stores/pipeline-store.ts` [UPDATED]

**Stories**: US-033 (pipeline visualization in task detail), US-034-US-036 (all visualization states), US-037-US-041 (all log panel features -- wiring)

**14.1 -- TaskDetailView Updates**:
- Import `PipelineVisualization` and wire into layout
- Set `uiStore.activeLogTaskId = taskId` on mount, clear on unmount:
  ```ts
  useEffect(() => {
    setActiveLogTaskId(taskId);
    return () => setActiveLogTaskId(null);
  }, [taskId, setActiveLogTaskId]);
  ```
- Activate SSE connection: `const { isConnected } = useSSE({ taskId, enabled: true });`
- Hydrate pipeline state on mount (NFR-05-010):
  ```ts
  useEffect(() => {
    async function hydratePipeline() {
      const response = await fetch(`/api/pipeline/${taskId}/status`);
      if (response.ok) {
        const data = await response.json();
        if (data.status !== "none") {
          pipelineStore.getState().hydratePipelineRun(taskId, data);
        }
      }
    }
    hydratePipeline();
  }, [taskId]);
  ```
- Updated layout:
  ```tsx
  {/* Pipeline Visualization (replaces UOW-03 placeholder) */}
  <div className="rounded-lg border bg-card p-4" data-testid="pipeline-section">
    <PipelineVisualization taskId={taskId} />
  </div>

  {/* Task details: title, description, subtasks (existing from UOW-03) */}

  {/* Pipeline Controls (existing from UOW-04) */}
  <PipelineControls taskId={taskId} />
  ```
- Note: AgentLogPanel is NOT rendered here -- it lives in BottomDock. TaskDetailView only sets `activeLogTaskId` so BottomDock/AgentLogPanel knows which task to show logs for.

**14.2 -- pipelineStore Extensions**:

New state:
```ts
phaseTimings: Map<string, PhaseTimingsMap>;  // key: taskId
```

Updated `updatePhase` action:
```ts
updatePhase(taskId, phase, status, iteration, timestamp):
  // UOW-04 behavior (update pipelineRun) + UOW-05 additions:
  // 1. Record completedAt for previous phase in phaseTimings
  // 2. Calculate duration for previous phase
  // 3. Record startedAt for new phase in phaseTimings
```

Updated `appendLog` action (BR-05-014 grouping):
```ts
appendLog(taskId, agent, chunk, timestamp):
  // 1. Validate input with appendLogInputSchema
  // 2. Get or create agentLogs[taskId][agent] array
  // 3. Check last entry for that agent:
  //    - If exists && (timestamp - lastEntry.timestamp < LOG_ENTRY_GROUP_THRESHOLD_MS):
  //      -> Append chunk to lastEntry.content, keep lastEntry.isStreaming = true
  //    - Else:
  //      -> Create new LogEntry: { id: crypto.randomUUID(), agentType: agent, content: chunk, timestamp, isStreaming: true }
  //      -> Mark previous entry's isStreaming = false
  // 4. Enforce buffer cap (NFR-05-011): if length > LOG_BUFFER_MAX_ENTRIES, remove oldest
```

New selectors:
```ts
getPhaseTimings(taskId: string): PhaseTimingsMap | null
getActivePhaseTiming(taskId: string): { phase, elapsed } | null
```

New action:
```ts
hydratePipelineRun(taskId: string, data: any): void
  // Populate pipelineRun + phaseTimings from server response (SSE reconnection recovery)
```

**data-testid Attributes** (on TaskDetailView):
- `data-testid="pipeline-section"` on the PipelineVisualization wrapper div

**Testing Notes**:
- Verify `activeLogTaskId` is set to taskId on mount
- Verify `activeLogTaskId` is cleared (null) on unmount
- Verify `useSSE` is called with `{ taskId, enabled: true }`
- Verify `PipelineVisualization` receives correct `taskId` prop
- Verify hydration fetch fires on mount and populates store
- Test `appendLog` grouping: two chunks within 500ms -> single LogEntry
- Test `appendLog` grouping: two chunks 600ms apart -> two LogEntries
- Test buffer cap: add 10,001 entries -> oldest removed, length = 10,000
- Test `updatePhase`: verify phaseTimings updated with completedAt for previous phase and startedAt for new phase

---

### Step 15: Unit Tests

- [ ] **15.1** `__tests__/components/pipeline/pipeline-visualization.test.tsx`
- [ ] **15.2** `__tests__/components/pipeline/pipeline-node.test.tsx`
- [ ] **15.3** `__tests__/components/pipeline/pipeline-connector.test.tsx`
- [ ] **15.4** `__tests__/components/pipeline/pipeline-timer.test.tsx`
- [ ] **15.5** `__tests__/components/agent-log/agent-log-panel.test.tsx`
- [ ] **15.6** `__tests__/components/agent-log/agent-log-tab.test.tsx`
- [ ] **15.7** `__tests__/components/agent-log/log-entry.test.tsx`
- [ ] **15.8** `__tests__/hooks/use-auto-scroll.test.ts`
- [ ] **15.9** `__tests__/hooks/use-typing-effect.test.ts`
- [ ] **15.10** `__tests__/hooks/use-pipeline-visualization.test.ts`

**Test Framework**: Vitest + React Testing Library + @testing-library/react-hooks

**15.1 -- PipelineVisualization Tests**:
- Story: US-033
- Tests:
  - Renders 5 pipeline nodes and 4 connectors
  - All nodes "pending" when no pipelineRun in store
  - Correct node statuses for each server phase (planning, coding, reviewing, fixing, completed, failed)
  - `data-testid` attributes present for all elements
  - Responsive: labels hidden at mobile viewport (mock matchMedia)

**15.2 -- PipelineNode Tests**:
- Stories: US-033, US-034, US-036
- Tests:
  - Renders correct icon for each status (default, CheckCircle2, XCircle)
  - Pending: dimmed opacity, gray border
  - Active: pulse animation props present (scale, boxShadow with Infinity repeat)
  - Completed: green border, CheckCircle2 icon
  - Failed: red border, XCircle icon
  - AnimatePresence wraps icon (key changes on status change)
  - No store imports in component file (NFR-05-022 enforcement)

**15.3 -- PipelineConnector Tests**:
- Story: US-033
- Tests:
  - Status "empty": fill width 0%
  - Status "filling": fill animates to 100% with 0.8s duration
  - Status "filled": fill at 100%
  - Fill color matches `color` prop
  - No store imports (NFR-05-022)

**15.4 -- PipelineTimer Tests**:
- Story: US-035
- Tests:
  - Pending: renders null (no output)
  - Active: renders live timer, ticks every 1s (fake timers)
  - Completed < 60s: renders "Xs" format (e.g., "12s")
  - Completed >= 60s: renders "M:SS" format (e.g., "1:45")
  - Failed: renders duration in red
  - Interval cleaned up on unmount
  - Format edge cases: 0s, 59s, 60s, 3599s

**15.5 -- AgentLogPanel Tests**:
- Stories: US-037, US-038, US-041
- Tests:
  - Renders 3 tabs (Planner, Coder, Reviewer)
  - Default active tab is Planner
  - Tab switch updates content
  - Empty state message when no logs
  - Unread dot appears on inactive tab when logs arrive
  - Unread dot clears on tab switch
  - Tab colors match AGENT_TABS config

**15.6 -- AgentLogTab Tests**:
- Stories: US-038, US-040
- Tests:
  - Empty logs: renders empty message
  - Non-empty logs: renders LogEntry components
  - "Jump to latest" button appears when scrolled up
  - "Jump to latest" button hidden when at bottom
  - Clicking "Jump to latest" calls scrollToBottom
  - `font-mono` class present on scroll container

**15.7 -- LogEntry Tests**:
- Stories: US-039, US-041
- Tests:
  - Timestamp formatted as `[HH:MM:SS]`
  - Content color matches `color` prop
  - `isStreaming = true`: typing effect active, blinking cursor shown
  - `isStreaming = false`: full content displayed, no cursor
  - XSS payload rendered as plain text (not executed)

**15.8 -- useAutoScroll Tests**:
- Story: US-040
- Tests:
  - `isAtBottom` defaults to true
  - Scroll up > 50px -> `isAtBottom` = false
  - Scroll back to bottom -> `isAtBottom` = true
  - `scrollToBottom()` scrolls to bottom + sets `isAtBottom = true`
  - MutationObserver disconnected when `isAtBottom = false`

**15.9 -- useTypingEffect Tests**:
- Story: US-039
- Tests:
  - `enabled = false`: displayedText = full text, isTyping = false
  - `enabled = true`: progressively reveals text
  - `isTyping` becomes false when complete
  - Text growth (append): continues from current position
  - rAF cancelled on unmount
  - Graceful degradation: simulated slow frames increase chars per append

**15.10 -- usePipelineVisualization Tests**:
- Story: US-033
- Tests:
  - No pipelineRun: all 5 nodes "pending", isActive = false
  - Each server phase: correct node statuses
  - Failed state: correct node marked "failed"
  - Cancelled: all "pending"
  - Iteration count passed through
  - "plan" node special case: completes when active moves past coding
  - Exactly 5 nodes always returned
  - Only 1 "active" node at most

**NFR Test Coverage**:

| NFR | Test Method |
|-----|-------------|
| NFR-05-001 (animation FPS) | Manual: Chrome DevTools Performance trace |
| NFR-05-002 (SSE latency) | Manual: performance.mark instrumentation |
| NFR-05-003 (log scale) | Unit: seed 5,000 entries, measure render time |
| NFR-05-004 (typing perf) | Unit: verify re-render count <= 20/s |
| NFR-05-005 (viz render) | Unit: measure mount/re-render time |
| NFR-05-007 (XSS) | Unit: inject XSS payloads, verify plain text |
| NFR-05-011 (buffer cap) | Unit: verify array length capped at 10,000 |
| NFR-05-012 (malformed SSE) | Unit: feed invalid data, verify no crash |
| NFR-05-022 (isolation) | Static: verify no store imports in leaf components |

---

### Step 16: Documentation Summary

- [ ] **16.1** Update this plan with final implementation notes and deviations

**File**: `aidlc-docs/construction/plans/pipeline-ui-logs-code-generation-plan.md` [THIS FILE]

**Details**:
- After implementation, update each step's checkbox with completion status
- Note any deviations from the plan (file path changes, API changes, etc.)
- Record actual test coverage metrics
- List any deferred items for post-MVP

---

## Implementation Order & Dependencies

```
Step 1  (Types)
  |
  v
Step 2  (Constants)
  |
  v
Step 14.2 (pipelineStore + uiStore extensions) ----+
  |                                                 |
  v                                                 |
Step 3  (usePipelineVisualization hook)             |
  |                                                 |
  v                                                 |
Step 4  (PipelineVisualization)                     |
  |                                                 |
  +-- Step 5  (PipelineNode)                        |
  |     |                                           |
  |     +-- Step 7  (PipelineTimer)                 |
  |                                                 |
  +-- Step 6  (PipelineConnector)                   |
                                                    |
Step 8  (useAutoScroll hook)                        |
  |                                                 |
Step 9  (useTypingEffect hook)                      |
  |                                                 |
  v                                                 |
Step 12 (LogEntry) ----+                            |
  |                    |                            |
  v                    v                            |
Step 11 (AgentLogTab)  |                            |
  |                    |                            |
  v                    |                            |
Step 10 (AgentLogPanel) <--------------------------+
  |
  v
Step 13 (BottomDock update)
  |
  v
Step 14.1 (TaskDetailView update)
  |
  v
Step 15 (Tests)
  |
  v
Step 16 (Documentation)
```

**Parallelization Opportunities**:
- Steps 3-7 (pipeline visualization branch) can be developed in parallel with Steps 8-12 (agent log branch) after Steps 1-2 are complete
- Step 13 (BottomDock) depends on Step 10 (AgentLogPanel)
- Step 14 (TaskDetailView) depends on Steps 4 and 13
- Step 15 (Tests) can partially proceed alongside implementation (test each step as it completes)

---

## Story Traceability Matrix

| Story | Title | Priority | Steps |
|-------|-------|----------|-------|
| US-033 | View Pipeline Stages | Must | 1, 2, 3, 4, 5, 6, 14, 15 |
| US-034 | Current Stage Pulses | Must | 1, 2, 5, 15 |
| US-035 | Phase Timing Display | Should | 1, 2, 7, 14.2, 15 |
| US-036 | Completed Stages Show Checkmark | Must | 1, 5, 15 |
| US-037 | Open and Collapse Log Panel | Must | 2, 13, 15 |
| US-038 | Switch Agent Tabs | Must | 1, 10, 11, 15 |
| US-039 | Streaming Text with Typing Effect | Must | 1, 2, 9, 12, 15 |
| US-040 | Auto-Scroll Behavior | Should | 2, 8, 11, 15 |
| US-041 | Timestamps and Color Coding | Should | 1, 2, 10, 12, 15 |

---

## Business Rule Coverage Matrix

| Rule ID | Domain | Steps | Components |
|---------|--------|-------|------------|
| BR-05-001 | Fixed 5-Node Layout | 1, 2, 3, 4 | PipelineVisualization, PIPELINE_NODES |
| BR-05-002 | Node Status Colors | 1, 5, 6 | PipelineNode, PipelineConnector |
| BR-05-003 | Single Active Node | 3, 4, 5 | usePipelineVisualization, PipelineVisualization |
| BR-05-004 | Phase Timing Format | 1, 2, 7 | PipelineTimer |
| BR-05-005 | Completed Checkmark | 5 | PipelineNode |
| BR-05-006 | Agent Tab Colors | 1, 10 | AgentLogPanel, AGENT_TABS |
| BR-05-007 | Auto-Scroll Threshold | 2, 8, 11 | useAutoScroll, AgentLogTab |
| BR-05-008 | Panel Height Constraints | 2, 13 | BottomDock, constants |
| BR-05-009 | Log Entry Timestamp | 12 | LogEntry |
| BR-05-010 | Empty Tab Placeholder | 10, 11 | AgentLogPanel, AgentLogTab |
| BR-05-011 | Panel Resize via Drag | 13 | BottomDock |
| BR-05-012 | Typing Effect Speed | 2, 9 | useTypingEffect, constants |
| BR-05-013 | Blinking Cursor | 9, 12 | useTypingEffect, LogEntry |
| BR-05-014 | Log Entry Grouping | 1, 2, 14.2 | pipelineStore.appendLog |
| BR-05-015 | Unread Tab Indicator | 10 | AgentLogPanel |
| BR-05-016 | Activity Indicator | 13 | BottomDock |
| BR-05-017 | Log Text Font | 11, 12 | AgentLogTab, LogEntry |

---

## NFR Coverage Matrix

| NFR ID | Category | Steps | Verification |
|--------|----------|-------|-------------|
| NFR-05-001 | Animation FPS | 5, 6, 13 | Manual: Chrome DevTools Performance |
| NFR-05-002 | SSE Processing | 14.2 | Manual: performance.mark |
| NFR-05-003 | Log Scale (5K entries) | 11 | Unit test + content-visibility CSS |
| NFR-05-004 | Typing Effect Perf | 9 | Unit test: re-render count |
| NFR-05-005 | Viz Render Time | 3, 4 | React DevTools Profiler |
| NFR-05-006 | No Layout Shifts | 11, 12 | Lighthouse CLS check |
| NFR-05-007 | XSS Prevention | 12 | Unit test: XSS payloads |
| NFR-05-008 | SSE Auth | (UOW-04 scope) | -- |
| NFR-05-009 | No Secrets in SSE | (UOW-04 scope) | -- |
| NFR-05-010 | SSE Reconnect | 14.1 | Integration test: offline/online |
| NFR-05-011 | Log Buffer Cap | 2, 14.2 | Unit test: buffer overflow |
| NFR-05-012 | Malformed SSE | 14.2 | Unit test: invalid JSON |
| NFR-05-013 | Log Preservation | 10 | Unit test: tab switch content |
| NFR-05-014 | Typing Degradation | 9 | Unit test: frame budget check |
| NFR-05-015 | Auto-Scroll UX | 8, 11 | Unit test + manual |
| NFR-05-016 | Tab Switch Speed | 10 | React DevTools: < 100ms |
| NFR-05-017 | Panel Resize | 13 | Manual: drag responsiveness |
| NFR-05-018 | Activity Indicator | 13 | Unit test: PulseDot visibility |
| NFR-05-019 | Responsive Viz | 4, 5 | Manual: viewport resize |
| NFR-05-020 | Keyboard A11y | 10, 13 | Manual: keyboard navigation |
| NFR-05-021 | Color Contrast | 1, 12 | axe-core automated check |
| NFR-05-022 | Component Isolation | 5, 6, 7, 12 | Static: verify no store imports |
| NFR-05-023 | SSE Type Safety | (UOW-04 scope) | -- |
| NFR-05-024 | Animation Constants | 2 | Static: no magic numbers in components |

---

## data-testid Summary

| data-testid | Component | Purpose |
|-------------|-----------|---------|
| `pipeline-visualization` | PipelineVisualization | Root container |
| `pipeline-node-{phase}` | PipelineVisualization | Node wrapper (spec, plan, code, review, done) |
| `pipeline-connector-{index}` | PipelineVisualization | Connector wrapper (0-3) |
| `pipeline-node` | PipelineNode | Root container |
| `pipeline-node-circle` | PipelineNode | Animated circle |
| `pipeline-node-icon` | PipelineNode | Icon wrapper |
| `pipeline-node-label` | PipelineNode | Label text |
| `pipeline-connector` | PipelineConnector | Track container |
| `pipeline-connector-fill` | PipelineConnector | Animated fill bar |
| `pipeline-timer` | PipelineTimer | Timer span |
| `pipeline-timer-active` | PipelineTimer | Live timer variant |
| `pipeline-timer-completed` | PipelineTimer | Static duration variant |
| `agent-log-panel` | AgentLogPanel | Root Tabs container |
| `agent-tab-{type}` | AgentLogPanel | Tab trigger (planner, coder, reviewer) |
| `agent-tab-content-{type}` | AgentLogPanel | Tab content wrapper |
| `agent-tab-unread-dot-{type}` | AgentLogPanel | Unread indicator dot |
| `agent-log-tab` | AgentLogTab | Root container |
| `agent-log-scroll-container` | AgentLogTab | Scrollable div |
| `agent-log-empty` | AgentLogTab | Empty state message |
| `jump-to-latest` | AgentLogTab | "Jump to latest" button |
| `log-entry` | LogEntry | Root div |
| `log-entry-timestamp` | LogEntry | Timestamp span |
| `log-entry-content` | LogEntry | Content span |
| `log-entry-cursor` | LogEntry | Blinking cursor |
| `bottom-dock` | BottomDock | Root motion.div |
| `bottom-dock-resize-handle` | BottomDock | Resize grip area |
| `bottom-dock-toggle-bar` | BottomDock | Toggle bar |
| `bottom-dock-toggle-button` | BottomDock | Expand/collapse button |
| `bottom-dock-activity-indicator` | BottomDock | PulseDot wrapper |
| `bottom-dock-content` | BottomDock | Content area |
| `pipeline-section` | TaskDetailView | Pipeline visualization wrapper |

---

## Framer Motion Animation Summary

| Component | Animation | Trigger | Duration | Easing | Constants |
|-----------|-----------|---------|----------|--------|-----------|
| PipelineNode | Scale pulse + glow | `isActive = true` | 2s (infinite) | easeInOut | `PULSE_ANIMATION_DURATION`, `PULSE_SCALE_RANGE`, `PULSE_GLOW_SIZE` |
| PipelineNode | Icon swap (scale + opacity) | Status change | 0.2s | default spring | `ICON_SWAP_DURATION` |
| PipelineNode | Border color transition | Status change | 0.3s | default | `BORDER_TRANSITION_DURATION` |
| PipelineNode | Opacity dim/brighten | pending <-> other | 0.3s | default | `NODE_PENDING_OPACITY` |
| PipelineConnector | Width fill (0% -> 100%) | status = "filling" | 0.8s | easeOut | `CONNECTOR_FILL_DURATION` |
| PipelineConnector | Width snap | status = "filled" | 0.3s | default | -- |
| BottomDock | Height collapse/expand | toggle | spring | stiffness: 300, damping: 30 | `PANEL_SPRING_STIFFNESS`, `PANEL_SPRING_DAMPING` |
| LogEntry cursor | Blink (opacity 1 -> 0 -> 1) | `isTyping = true` | 1s (infinite) | step-end | CSS keyframe (not Framer Motion) |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Typing effect causes excessive re-renders with many simultaneous LogEntries | Performance degradation, dropped frames | rAF-based approach limits to 20 renders/sec; graceful degradation at 32ms frame budget (NFR-05-014) |
| 10,000 log entries overwhelm DOM rendering | Scroll jank, high memory | Buffer cap + `content-visibility: auto` CSS; deferred `@tanstack/virtual` if needed |
| Panel resize causes layout thrashing during drag | Janky resize UX | Direct state update on mousemove (no debounce); Framer Motion spring handles the animation |
| SSE reconnection leaves stale pipeline state | Incorrect visualization | Hydration fetch on mount + reconnect (NFR-05-010) |
| Malformed SSE events crash the UI | Blank screen / error boundary | Zod validation + try/catch in useSSE dispatch (NFR-05-012) |

---

## Acceptance Criteria Checklist

Before marking UOW-05 complete, verify:

- [ ] 5-node pipeline visualization renders correctly for all server phases
- [ ] Active node pulses with scale + glow animation
- [ ] Completed nodes show green CheckCircle2 icon
- [ ] Failed nodes show red XCircle icon
- [ ] Phase timing displays live counter (MM:SS) for active, static (Xs or M:SS) for completed
- [ ] Agent log panel opens/collapses in BottomDock
- [ ] 3 agent tabs with correct colors (amber/blue/purple)
- [ ] Tab switching is instant (< 100ms)
- [ ] Unread dot appears on inactive tabs receiving new logs
- [ ] Log entries stream with typing effect
- [ ] Blinking cursor visible during streaming
- [ ] Auto-scroll follows new content when at bottom
- [ ] Auto-scroll pauses when user scrolls up > 50px
- [ ] "Jump to latest" button appears when scrolled up
- [ ] Timestamps formatted as [HH:MM:SS]
- [ ] Log text in monospace (font-mono)
- [ ] Panel resizable via drag handle (36px min, 50vh max)
- [ ] Double-click resize handle toggles collapsed/expanded
- [ ] Activity indicator on collapsed panel when pipeline running
- [ ] XSS payloads in log content render as plain text
- [ ] All unit tests passing
- [ ] No store imports in leaf components (PipelineNode, PipelineConnector, PipelineTimer, LogEntry)
- [ ] No magic numbers in component files (all from constants)
- [ ] All data-testid attributes present
