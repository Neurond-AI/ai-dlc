# Domain Entities -- UOW-05: Pipeline UI & Agent Logs

## Overview

UOW-05 is a purely frontend unit. No new database entities are introduced. This document defines the TypeScript types and interfaces used by UOW-05 components, hooks, and store extensions. All types extend or consume the pipeline types defined in UOW-04 (`types/pipeline.ts`, `types/agent.ts`, `types/sse.ts`).

---

## New TypeScript Types

### types/pipeline-ui.ts

```ts
import type { PipelinePhase, PipelineStatus } from "./pipeline";
import type { AgentType } from "./agent";

// -- Pipeline Visualization Node --

export type VisualizationNodePhase = "spec" | "plan" | "code" | "review" | "done";

export type NodeStatus = "pending" | "active" | "completed" | "failed";

export interface PipelineNodeState {
  /** Which visualization node */
  phase: VisualizationNodePhase;
  /** Current visual status */
  status: NodeStatus;
  /** When this phase started (Unix ms), undefined if not yet started */
  startedAt?: number;
  /** When this phase completed (Unix ms), undefined if still active or pending */
  completedAt?: number;
  /** Duration in ms (completedAt - startedAt), undefined if not completed */
  duration?: number;
}

// -- Pipeline Node Configuration --

export interface PipelineNodeConfig {
  /** Visualization phase identifier */
  phase: VisualizationNodePhase;
  /** Display label */
  label: string;
  /** Lucide icon name */
  icon: string;
  /** Maps to server PipelinePhase(s) that activate this node */
  serverPhases: PipelinePhase[];
}

export const PIPELINE_NODES: PipelineNodeConfig[] = [
  { phase: "spec", label: "Spec", icon: "FileText", serverPhases: ["planning"] },
  { phase: "plan", label: "Plan", icon: "ListChecks", serverPhases: [] },
  { phase: "code", label: "Code", icon: "Code2", serverPhases: ["coding", "fixing"] },
  { phase: "review", label: "Review", icon: "Search", serverPhases: ["reviewing"] },
  { phase: "done", label: "Done", icon: "CheckCircle2", serverPhases: ["completed"] },
];

// -- Phase Timing --

export interface PhaseTiming {
  startedAt: number;
  completedAt?: number;
  duration?: number;
}

/**
 * Maps visualization node phase to its timing data.
 * Stored in pipelineStore.phaseTimings per taskId.
 */
export type PhaseTimingsMap = Partial<Record<VisualizationNodePhase, PhaseTiming>>;

// -- Node Status Colors --

export interface NodeColorScheme {
  /** Border/icon color */
  border: string;
  /** Background with opacity */
  bg: string;
  /** Text color */
  text: string;
  /** Glow/shadow color for pulse animation */
  glow: string;
}

export const NODE_STATUS_COLORS: Record<NodeStatus, NodeColorScheme> = {
  pending: {
    border: "#6B7280",
    bg: "bg-gray-500/5",
    text: "text-gray-400",
    glow: "rgba(107, 114, 128, 0)",
  },
  active: {
    border: "", // overridden by phase-specific color
    bg: "",
    text: "",
    glow: "",
  },
  completed: {
    border: "#22C55E",
    bg: "bg-green-500/10",
    text: "text-green-500",
    glow: "rgba(34, 197, 94, 0.15)",
  },
  failed: {
    border: "#EF4444",
    bg: "bg-red-500/10",
    text: "text-red-500",
    glow: "rgba(239, 68, 68, 0.15)",
  },
};

/**
 * Phase-specific colors used when node is "active".
 * Maps server PipelinePhase to color for the active node.
 */
export const ACTIVE_PHASE_COLORS: Record<string, NodeColorScheme> = {
  planning: {
    border: "#F59E0B",
    bg: "bg-amber-500/10",
    text: "text-amber-500",
    glow: "rgba(245, 158, 11, 0.15)",
  },
  coding: {
    border: "#3B82F6",
    bg: "bg-blue-500/10",
    text: "text-blue-500",
    glow: "rgba(59, 130, 246, 0.15)",
  },
  fixing: {
    border: "#3B82F6",
    bg: "bg-blue-500/10",
    text: "text-blue-500",
    glow: "rgba(59, 130, 246, 0.15)",
  },
  reviewing: {
    border: "#8B5CF6",
    bg: "bg-purple-500/10",
    text: "text-purple-500",
    glow: "rgba(139, 92, 246, 0.15)",
  },
  completed: {
    border: "#22C55E",
    bg: "bg-green-500/10",
    text: "text-green-500",
    glow: "rgba(34, 197, 94, 0.15)",
  },
};
```

---

### types/agent-log-ui.ts

```ts
import type { AgentType } from "./agent";

// -- Log Entry (Extended for UI) --

export interface LogEntry {
  /** Unique entry ID (generated client-side) */
  id: string;
  /** Which agent produced this entry */
  agentType: AgentType;
  /** Full text content (may grow if chunks are grouped) */
  content: string;
  /** Entry timestamp (Unix ms) */
  timestamp: number;
  /** Whether this entry is still receiving streaming chunks */
  isStreaming: boolean;
}

// -- Agent Tab Configuration --

export interface AgentTab {
  /** Agent identifier */
  type: AgentType;
  /** Display label */
  label: string;
  /** Hex color for accent (tab underline, text, dot) */
  color: string;
  /** Lucide icon name */
  icon: string;
}

export const AGENT_TABS: AgentTab[] = [
  { type: "planner", label: "Planner", color: "#F59E0B", icon: "Brain" },
  { type: "coder", label: "Coder", color: "#3B82F6", icon: "Code2" },
  { type: "reviewer", label: "Reviewer", color: "#8B5CF6", icon: "Search" },
];

/**
 * Lookup map for agent tab colors by agent type.
 */
export const AGENT_TAB_COLORS: Record<AgentType, string> = {
  planner: "#F59E0B",
  coder: "#3B82F6",
  reviewer: "#8B5CF6",
};
```

---

## Zod Validation Schemas

### lib/validations/pipeline-ui-schemas.ts

```ts
import { z } from "zod";

// -- Visualization Node Phase --

export const visualizationNodePhaseSchema = z.enum([
  "spec",
  "plan",
  "code",
  "review",
  "done",
]);

// -- Node Status --

export const nodeStatusSchema = z.enum([
  "pending",
  "active",
  "completed",
  "failed",
]);

// -- Connector Status --

export const connectorStatusSchema = z.enum([
  "empty",
  "filling",
  "filled",
]);

// -- Phase Timing --

export const phaseTimingSchema = z.object({
  startedAt: z.number().int().positive(),
  completedAt: z.number().int().positive().optional(),
  duration: z.number().int().nonnegative().optional(),
});

// -- Pipeline Node State (for component props validation) --

export const pipelineNodeStateSchema = z.object({
  phase: visualizationNodePhaseSchema,
  status: nodeStatusSchema,
  startedAt: z.number().optional(),
  completedAt: z.number().optional(),
  duration: z.number().optional(),
});

// -- Log Entry (client-side structured entry) --

export const logEntrySchema = z.object({
  id: z.string().min(1),
  agentType: z.enum(["planner", "coder", "reviewer"]),
  content: z.string(),
  timestamp: z.number().int().positive(),
  isStreaming: z.boolean(),
});

// -- Agent Log Append Input (from SSE dispatch) --

export const appendLogInputSchema = z.object({
  taskId: z.string().min(1),
  agent: z.enum(["planner", "coder", "reviewer"]),
  chunk: z.string().min(1),
  timestamp: z.number().int().positive(),
});

// -- Phase Update Input (from SSE dispatch) --

export const phaseUpdateInputSchema = z.object({
  taskId: z.string().min(1),
  phase: z.enum([
    "planning",
    "coding",
    "reviewing",
    "fixing",
    "completed",
    "failed",
    "cancelled",
    "paused",
  ]),
  status: z.enum(["running", "passed", "failed", "cancelled", "paused"]),
  iteration: z.number().int().min(0),
  timestamp: z.number().int().positive(),
});

// -- UI Store Extensions Input --

export const logPanelHeightSchema = z.number()
  .int()
  .min(36)   // LOG_PANEL_COLLAPSED_HEIGHT
  .max(1080) // reasonable max px (will be clamped to 50vh at runtime)
  .default(300);

// -- Inferred Types --

export type VisualizationNodePhaseSchema = z.infer<typeof visualizationNodePhaseSchema>;
export type NodeStatusSchema = z.infer<typeof nodeStatusSchema>;
export type PhaseTimingSchema = z.infer<typeof phaseTimingSchema>;
export type PipelineNodeStateSchema = z.infer<typeof pipelineNodeStateSchema>;
export type LogEntrySchema = z.infer<typeof logEntrySchema>;
export type AppendLogInputSchema = z.infer<typeof appendLogInputSchema>;
export type PhaseUpdateInputSchema = z.infer<typeof phaseUpdateInputSchema>;
```

**Validation Usage**:
- `appendLogInputSchema`: validates SSE agent-log event data before dispatching to `pipelineStore.appendLog`
- `phaseUpdateInputSchema`: validates SSE phase-change event data before dispatching to `pipelineStore.updatePhase`
- `logEntrySchema`: validates internal LogEntry structure (used in tests)
- `logPanelHeightSchema`: validates panel height before persisting to `uiStore`

---

## Store Type Extensions

### pipelineStore Extensions (types)

```ts
import type { PhaseTimingsMap } from "./pipeline-ui";
import type { LogEntry } from "./agent-log-ui";

/**
 * Extended AgentLogsState for UOW-05.
 * Replaces UOW-04's simple string array with structured LogEntry objects.
 */
export interface AgentLogsStateV2 {
  planner: LogEntry[];
  coder: LogEntry[];
  reviewer: LogEntry[];
}

/**
 * Additional state fields added to pipelineStore in UOW-05.
 */
export interface PipelineStoreExtensions {
  /** Phase timing data per task */
  phaseTimings: Map<string, PhaseTimingsMap>;
}
```

### uiStore Extensions (types)

```ts
/**
 * Additional state fields added to uiStore in UOW-05.
 */
export interface UIStoreExtensions {
  /** Task ID whose logs are currently displayed in AgentLogPanel */
  activeLogTaskId: string | null;
  /** Whether the bottom dock log panel is expanded */
  isLogPanelExpanded: boolean;
  /** Current log panel height in pixels */
  logPanelHeight: number;
}
```

---

## Hook Return Types

### useAutoScroll

```ts
export interface UseAutoScrollReturn {
  /** Ref to attach to the scrollable container */
  scrollRef: React.RefObject<HTMLDivElement>;
  /** Whether the container is scrolled to the bottom (within threshold) */
  isAtBottom: boolean;
  /** Programmatically scroll to bottom and resume auto-scroll */
  scrollToBottom: () => void;
}
```

### useTypingEffect

```ts
export interface UseTypingEffectOptions {
  /** Full text to reveal progressively */
  text: string;
  /** Characters to append per frame (default: 30) */
  charsPerFrame?: number;
  /** Minimum ms between appends (default: 50) */
  frameInterval?: number;
  /** Whether typing is enabled (false = show full text immediately) */
  enabled?: boolean;
}

export interface UseTypingEffectReturn {
  /** Currently displayed portion of text */
  displayedText: string;
  /** Whether text is still being revealed */
  isTyping: boolean;
}
```

### usePipelineVisualization

```ts
import type { PipelineNodeState } from "./pipeline-ui";

export interface UsePipelineVisualizationReturn {
  /** Status of all 5 pipeline nodes */
  nodes: PipelineNodeState[];
  /** Whether any node is currently active (pipeline running) */
  isActive: boolean;
  /** Current iteration number (0 if no iterations) */
  iteration: number;
}
```

---

## Enum & Constant Definitions

### Connector States

```ts
export type ConnectorStatus = "empty" | "filling" | "filled";
```

### Panel Dimensions

```ts
export const LOG_PANEL_COLLAPSED_HEIGHT = 36;    // px
export const LOG_PANEL_DEFAULT_HEIGHT = 300;     // px
export const LOG_PANEL_MAX_HEIGHT_VH = 50;       // vh (50% of viewport)
```

### Typing Effect Defaults

```ts
export const TYPING_CHARS_PER_FRAME = 30;
export const TYPING_FRAME_INTERVAL_MS = 50;
```

### Auto-Scroll Threshold

```ts
export const AUTO_SCROLL_THRESHOLD_PX = 50;
```

### Log Entry Grouping

```ts
export const LOG_ENTRY_GROUP_THRESHOLD_MS = 500;
```

---

## Entity Relationship Context (UOW-05 Frontend)

```
pipelineStore (Zustand, UOW-04 + UOW-05 extensions)
  |
  ├── pipelineRuns: Map<taskId, PipelineRunState>
  |     |
  |     └── Consumed by: PipelineVisualization -> PipelineNode (x5)
  |                       PipelineControls (UOW-04)
  |
  ├── agentLogs: Map<taskId, AgentLogsStateV2>
  |     |
  |     └── Consumed by: AgentLogPanel -> AgentLogTab (x3) -> LogEntry (xN)
  |
  └── phaseTimings: Map<taskId, PhaseTimingsMap>  [NEW in UOW-05]
        |
        └── Consumed by: PipelineTimer (x5, one per node)

uiStore (Zustand, UOW-01 + UOW-05 extensions)
  |
  ├── activeLogTaskId: string | null              [NEW in UOW-05]
  |     |
  |     └── Consumed by: AgentLogPanel (which task's logs to show)
  |
  ├── isLogPanelExpanded: boolean                 [NEW in UOW-05]
  |     |
  |     └── Consumed by: BottomDock (collapse/expand)
  |
  └── logPanelHeight: number                      [NEW in UOW-05]
        |
        └── Consumed by: BottomDock (resize)
```

---

## Migration Notes

### agentLogs Format Change

UOW-04 defined `agentLogs` entries as `{ chunk: string, timestamp: number }`. UOW-05 extends this to `LogEntry` objects with `id`, `agentType`, `content`, `timestamp`, and `isStreaming`. The `appendLog` store action is updated to:

1. Generate a unique `id` for new entries (nanoid or crypto.randomUUID)
2. Check timestamp grouping (BR-05-014): if within 500ms of last entry for same agent, append content to existing entry
3. Set `isStreaming = true` on the entry being appended to
4. Mark previous entries as `isStreaming = false` when a new entry starts

This is a backwards-compatible extension: the store action signature remains the same, only the internal storage format changes.
