# Frontend Components -- UOW-05: Pipeline UI & Agent Logs

## Overview

This document defines all frontend components delivered in UOW-05. Each component includes its file path, props interface, internal state, user interactions, Framer Motion animations, store reads, and responsive behavior. Components use shadcn/ui primitives, Tailwind v4, Framer Motion, Lucide icons, and Zustand stores.

---

## Pipeline Visualization Components

### PipelineVisualization

| Field | Value |
|-------|-------|
| **File** | `src/components/pipeline/pipeline-visualization.tsx` |
| **Type** | Client Component (`"use client"`) |
| **Purpose** | Horizontal flow container rendering 5 pipeline nodes with animated connectors |
| **Used In** | `src/components/task/task-detail-view.tsx` (top section) |

**Props Interface**:
```ts
interface PipelineVisualizationProps {
  taskId: string;
}
```

**Internal State**:
- Reads from `pipelineStore`:
  - `pipelineRuns.get(taskId)` -> `PipelineRunState` (phase, status, iteration)
  - `phaseTimings.get(taskId)` -> `PhaseTimingsMap`
- Derived state via `usePipelineVisualization(taskId)` hook:
  - `nodes: PipelineNodeState[]` (5 items, each with phase + status + timing)
  - `isActive: boolean`
  - `iteration: number`

**Rendering Logic**:
```tsx
const { nodes, isActive, iteration } = usePipelineVisualization(taskId);

return (
  <div className="flex items-center justify-between gap-0 px-4 py-6">
    {nodes.map((node, index) => (
      <Fragment key={node.phase}>
        <PipelineNode
          config={PIPELINE_NODES[index]}
          state={node}
          isActive={node.status === "active"}
        />
        {index < nodes.length - 1 && (
          <PipelineConnector
            status={deriveConnectorStatus(nodes[index], nodes[index + 1])}
            color={getConnectorColor(nodes[index + 1])}
          />
        )}
      </Fragment>
    ))}
  </div>
);
```

**Layout**:
```
+-------------------------------------------------------------------+
|                                                                   |
|  [Spec]  ====  [Plan]  ====  [Code]  ====  [Review]  ====  [Done] |
|   12s           8s          (01:23)    pending       pending      |
|                                                                   |
+-------------------------------------------------------------------+
```

**Responsive Behavior**:
- Desktop (>= 768px): horizontal layout with full labels and timing
- Mobile (< 768px): nodes shrink to icon-only, labels hidden, connectors shortened
- Breakpoint: `md:` prefix for label visibility

**Framer Motion**:
- Container: no animation (static flex layout)
- Individual nodes and connectors handle their own animations

**Business Rules**: BR-05-001, BR-05-003

---

### PipelineNode

| Field | Value |
|-------|-------|
| **File** | `src/components/pipeline/pipeline-node.tsx` |
| **Type** | Client Component (`"use client"`) |
| **Purpose** | Single pipeline stage node with icon, label, status indicator, and timing display |

**Props Interface**:
```ts
interface PipelineNodeProps {
  config: PipelineNodeConfig;   // { phase, label, icon, serverPhases }
  state: PipelineNodeState;     // { phase, status, startedAt?, completedAt?, duration? }
  isActive: boolean;
}
```

**Internal State**: None (purely derived from props)

**Rendering Logic**:
```tsx
const colors = getNodeColors(state.status, pipelinePhase);
const Icon = getNodeIcon(state.status, config.icon);

return (
  <div className="flex flex-col items-center gap-1.5">
    <motion.div
      className={cn(
        "flex h-12 w-12 items-center justify-center rounded-full border-2",
        colors.bg
      )}
      style={{ borderColor: colors.border }}
      animate={isActive ? pulseAnimation : {}}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={state.status}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <Icon className={cn("h-5 w-5", colors.text)} />
        </motion.div>
      </AnimatePresence>
    </motion.div>
    <span className={cn("text-xs font-medium", colors.text)}>
      {config.label}
    </span>
    <PipelineTimer phase={config.phase} state={state} />
  </div>
);
```

**Icon Resolution**:

| Status | Icon |
|--------|------|
| pending | Config default icon (Lucide), dimmed |
| active | Config default icon (Lucide), full color |
| completed | CheckCircle2 (Lucide), green |
| failed | XCircle (Lucide), red |

**Framer Motion -- Active Pulse**:
```ts
const pulseAnimation = {
  scale: [1, 1.05, 1],
  boxShadow: [
    `0 0 0 0 ${colors.glow}`,
    `0 0 0 8px ${colors.glow}`,
    `0 0 0 0 ${colors.glow}`,
  ],
};

const pulseTransition = {
  duration: 2,
  repeat: Infinity,
  ease: "easeInOut" as const,
};
```

**Framer Motion -- Status Change**:
```ts
// Icon swap via AnimatePresence (shown above)
// Border color transition:
<motion.div
  animate={{ borderColor: colors.border }}
  transition={{ duration: 0.3 }}
/>
```

**Business Rules**: BR-05-002, BR-05-003, BR-05-005

---

### PipelineConnector

| Field | Value |
|-------|-------|
| **File** | `src/components/pipeline/pipeline-connector.tsx` |
| **Type** | Client Component (`"use client"`) |
| **Purpose** | Animated horizontal line connecting two pipeline nodes |

**Props Interface**:
```ts
interface PipelineConnectorProps {
  status: ConnectorStatus;   // "empty" | "filling" | "filled"
  color: string;             // Hex color for fill
}
```

**Internal State**: None (purely derived from props)

**Rendering Logic**:
```tsx
return (
  <div className="relative flex-1 h-0.5 bg-muted mx-1">
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
          ? { duration: 0.8, ease: "easeOut" }
          : { duration: 0.3 }
      }
    />
  </div>
);
```

**Layout**:
```
Track:  ════════════════════════  (bg-muted, 2px height)
Fill:   ██████████░░░░░░░░░░░░  (animated width, colored)
```

**Connector Status Derivation** (in PipelineVisualization):
```ts
function deriveConnectorStatus(leftNode: PipelineNodeState, rightNode: PipelineNodeState): ConnectorStatus {
  if (rightNode.status === "completed" || rightNode.status === "failed") return "filled";
  if (rightNode.status === "active") return "filling";
  return "empty";
}
```

**Business Rules**: BR-05-002

---

### PipelineTimer

| Field | Value |
|-------|-------|
| **File** | `src/components/pipeline/pipeline-timer.tsx` |
| **Type** | Client Component (`"use client"`) |
| **Purpose** | Live timer for active phase, static duration for completed phase |

**Props Interface**:
```ts
interface PipelineTimerProps {
  phase: VisualizationNodePhase;
  state: PipelineNodeState;
}
```

**Internal State**:
```ts
{
  elapsed: number;   // ms, updated every 1s for active phase
}
```

**Rendering Logic**:
```tsx
// Pending: render nothing
if (state.status === "pending") return null;

// Completed: static display
if (state.status === "completed" && state.duration !== undefined) {
  return (
    <span className="text-[10px] text-muted-foreground tabular-nums">
      {formatDuration(state.duration)}
    </span>
  );
}

// Active: live timer
if (state.status === "active" && state.startedAt) {
  return (
    <span className="text-[10px] text-muted-foreground tabular-nums">
      {formatElapsed(elapsed)}
    </span>
  );
}

// Failed: show duration up to failure
if (state.status === "failed" && state.duration !== undefined) {
  return (
    <span className="text-[10px] text-red-500 tabular-nums">
      {formatDuration(state.duration)}
    </span>
  );
}
```

**Timer Logic**:
```ts
useEffect(() => {
  if (state.status !== "active" || !state.startedAt) return;

  const interval = setInterval(() => {
    setElapsed(Date.now() - state.startedAt!);
  }, 1000);

  return () => clearInterval(interval);
}, [state.status, state.startedAt]);
```

**Format Functions**:
```ts
// Active: MM:SS with leading zeros
function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// Completed: Xs for <60s, M:SS for >=60s
function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
```

**Business Rules**: BR-05-004

---

## Agent Log Components

### AgentLogPanel

| Field | Value |
|-------|-------|
| **File** | `src/components/agent-log/agent-log-panel.tsx` |
| **Type** | Client Component (`"use client"`) |
| **Purpose** | Tabbed panel for viewing streaming agent logs, rendered inside BottomDock |
| **Used In** | `src/components/layout/bottom-dock.tsx` |

**Props Interface**:
```ts
// No external props. Reads from stores.
```

**Internal State**:
```ts
{
  activeTab: AgentType;                // Currently selected tab, default: "planner"
  unreadTabs: Set<AgentType>;          // Tabs with new content not yet viewed
}
```

**Reads from stores**:
- `uiStore`: `activeLogTaskId`
- `pipelineStore`: `agentLogs.get(activeLogTaskId)`, `pipelineRuns.get(activeLogTaskId)`

**Rendering Logic**:
```tsx
const taskId = useUIStore((s) => s.activeLogTaskId);
const agentLogs = usePipelineStore((s) => taskId ? s.agentLogs.get(taskId) : null);
const pipelineRun = usePipelineStore((s) => taskId ? s.pipelineRuns.get(taskId) : null);

// Track unread tabs
useEffect(() => {
  if (!agentLogs || !taskId) return;
  AGENT_TABS.forEach((tab) => {
    if (tab.type !== activeTab && agentLogs[tab.type].length > prevLengthRef.current[tab.type]) {
      setUnreadTabs((prev) => new Set(prev).add(tab.type));
    }
    prevLengthRef.current[tab.type] = agentLogs[tab.type].length;
  });
}, [agentLogs, activeTab, taskId]);

return (
  <Tabs
    value={activeTab}
    onValueChange={(value) => {
      setActiveTab(value as AgentType);
      setUnreadTabs((prev) => {
        const next = new Set(prev);
        next.delete(value as AgentType);
        return next;
      });
    }}
  >
    <TabsList className="h-9 gap-1 bg-transparent px-2">
      {AGENT_TABS.map((tab) => (
        <TabsTrigger
          key={tab.type}
          value={tab.type}
          className="relative gap-1.5 text-xs"
          style={{
            "--tab-active-color": tab.color,
          } as React.CSSProperties}
        >
          <TabIcon name={tab.icon} className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{tab.label}</span>
          {unreadTabs.has(tab.type) && (
            <span
              className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: tab.color }}
            />
          )}
        </TabsTrigger>
      ))}
    </TabsList>
    {AGENT_TABS.map((tab) => (
      <TabsContent key={tab.type} value={tab.type} className="flex-1 overflow-hidden">
        <AgentLogTab
          agentType={tab.type}
          logs={agentLogs?.[tab.type] ?? []}
          color={tab.color}
          isActive={pipelineRun?.status === "running"}
          emptyMessage={
            !taskId
              ? "No logs yet -- start a pipeline to see agent output."
              : `Waiting for ${tab.label} to start...`
          }
        />
      </TabsContent>
    ))}
  </Tabs>
);
```

**User Interactions**:

| Action | Handler | Result |
|--------|---------|--------|
| Click tab | `setActiveTab(type)` | Switch displayed log content, clear unread dot |
| New log on inactive tab | useEffect detects length change | Add dot indicator to tab |

**Business Rules**: BR-05-006, BR-05-010, BR-05-015

---

### AgentLogTab

| Field | Value |
|-------|-------|
| **File** | `src/components/agent-log/agent-log-tab.tsx` |
| **Type** | Client Component (`"use client"`) |
| **Purpose** | Scrollable log content area for a single agent, with auto-scroll and empty state |

**Props Interface**:
```ts
interface AgentLogTabProps {
  agentType: AgentType;
  logs: LogEntry[];
  color: string;              // Hex color for text accent
  isActive: boolean;          // Pipeline currently running
  emptyMessage: string;       // Placeholder when no logs
}
```

**Internal State**:
- Uses `useAutoScroll()` hook: `{ scrollRef, isAtBottom, scrollToBottom }`

**Rendering Logic**:
```tsx
const { scrollRef, isAtBottom, scrollToBottom } = useAutoScroll();

if (logs.length === 0) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      {emptyMessage}
    </div>
  );
}

return (
  <div className="relative h-full">
    <div
      ref={scrollRef}
      className="h-full overflow-y-auto scroll-smooth px-3 py-2 font-mono text-sm leading-relaxed"
    >
      {logs.map((entry) => (
        <LogEntry
          key={entry.id}
          entry={entry}
          color={color}
        />
      ))}
    </div>
    {!isAtBottom && (
      <button
        onClick={scrollToBottom}
        className="absolute bottom-2 right-3 flex items-center gap-1 rounded-full bg-background/80 px-3 py-1 text-xs shadow-md backdrop-blur-sm border"
      >
        Jump to latest
        <ArrowDown className="h-3 w-3" />
      </button>
    )}
  </div>
);
```

**User Interactions**:

| Action | Handler | Result |
|--------|---------|--------|
| Scroll up (>50px from bottom) | useAutoScroll detects | Pause auto-scroll, show "Jump to latest" button |
| Click "Jump to latest" | `scrollToBottom()` | Scroll to bottom, resume auto-scroll |
| New log entry while at bottom | useAutoScroll | Auto-scroll to keep latest visible |

**Business Rules**: BR-05-007, BR-05-010, BR-05-017

---

### LogEntry

| Field | Value |
|-------|-------|
| **File** | `src/components/agent-log/log-entry.tsx` |
| **Type** | Client Component (`"use client"`) |
| **Purpose** | Single log line with timestamp prefix, colored text, and typing effect |

**Props Interface**:
```ts
interface LogEntryProps {
  entry: LogEntry;
  color: string;        // Hex color for text
}
```

**Internal State**:
- Uses `useTypingEffect()` hook: `{ displayedText, isTyping }`

**Rendering Logic**:
```tsx
const { displayedText, isTyping } = useTypingEffect({
  text: entry.content,
  enabled: entry.isStreaming,
  charsPerFrame: TYPING_CHARS_PER_FRAME,
  frameInterval: TYPING_FRAME_INTERVAL_MS,
});

const timestamp = new Date(entry.timestamp).toLocaleTimeString("en-US", {
  hour12: false,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

return (
  <div className="flex gap-2 py-0.5">
    <span className="shrink-0 text-muted-foreground select-none">
      [{timestamp}]
    </span>
    <span style={{ color }}>
      {entry.isStreaming ? displayedText : entry.content}
      {isTyping && (
        <span className="animate-blink ml-px" style={{ color }}>|</span>
      )}
    </span>
  </div>
);
```

**CSS for Blinking Cursor**:
```css
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
.animate-blink {
  animation: blink 1s step-end infinite;
}
```

**Business Rules**: BR-05-009, BR-05-012, BR-05-013, BR-05-017

---

## Custom Hooks

### useAutoScroll

| Field | Value |
|-------|-------|
| **File** | `src/hooks/use-auto-scroll.ts` |
| **Type** | Custom React Hook |
| **Purpose** | Manage auto-scroll behavior for a scrollable container with pause/resume logic |

**Parameters**: None (stateless hook, returns ref + controls)

**Return Value**:
```ts
interface UseAutoScrollReturn {
  scrollRef: React.RefObject<HTMLDivElement>;
  isAtBottom: boolean;
  scrollToBottom: () => void;
}
```

**Implementation Logic**:
```ts
export function useAutoScroll(): UseAutoScrollReturn {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Check scroll position on scroll events
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setIsAtBottom(distanceFromBottom <= AUTO_SCROLL_THRESHOLD_PX);
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-scroll when content changes and user is at bottom
  useEffect(() => {
    if (!isAtBottom || !scrollRef.current) return;

    const el = scrollRef.current;
    // Use MutationObserver to detect content changes
    const observer = new MutationObserver(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });

    observer.observe(el, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [isAtBottom]);

  const scrollToBottom = useCallback(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    setIsAtBottom(true);
  }, []);

  return { scrollRef, isAtBottom, scrollToBottom };
}
```

**Business Rules**: BR-05-007

---

### useTypingEffect

| Field | Value |
|-------|-------|
| **File** | `src/hooks/use-typing-effect.ts` |
| **Type** | Custom React Hook |
| **Purpose** | Progressively reveal text content using requestAnimationFrame |

**Parameters**:
```ts
interface UseTypingEffectOptions {
  text: string;
  charsPerFrame?: number;    // default: 30
  frameInterval?: number;    // default: 50ms
  enabled?: boolean;         // default: true
}
```

**Return Value**:
```ts
interface UseTypingEffectReturn {
  displayedText: string;
  isTyping: boolean;
}
```

**Implementation Logic**:
```ts
export function useTypingEffect({
  text,
  charsPerFrame = TYPING_CHARS_PER_FRAME,
  frameInterval = TYPING_FRAME_INTERVAL_MS,
  enabled = true,
}: UseTypingEffectOptions): UseTypingEffectReturn {
  const [displayedText, setDisplayedText] = useState(enabled ? "" : text);
  const [isTyping, setIsTyping] = useState(enabled && text.length > 0);
  const indexRef = useRef(0);
  const lastTimeRef = useRef(0);
  const rafRef = useRef<number>();

  useEffect(() => {
    if (!enabled) {
      setDisplayedText(text);
      setIsTyping(false);
      return;
    }

    // If text grew (new chunk appended), continue from current position
    if (indexRef.current > text.length) {
      indexRef.current = 0;
    }

    setIsTyping(true);

    const animate = (timestamp: number) => {
      if (timestamp - lastTimeRef.current >= frameInterval) {
        lastTimeRef.current = timestamp;
        const nextIndex = Math.min(indexRef.current + charsPerFrame, text.length);
        indexRef.current = nextIndex;
        setDisplayedText(text.slice(0, nextIndex));

        if (nextIndex >= text.length) {
          setIsTyping(false);
          return; // Stop animation
        }
      }
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [text, charsPerFrame, frameInterval, enabled]);

  return { displayedText, isTyping };
}
```

**Performance Notes**:
- Uses `requestAnimationFrame` (not `setInterval`) for smooth animation synced to display refresh
- `indexRef` avoids re-renders on every frame; only `setDisplayedText` triggers render
- When text prop grows (appended chunk), typing continues from where it left off

**Business Rules**: BR-05-012, BR-05-013

---

### usePipelineVisualization

| Field | Value |
|-------|-------|
| **File** | `src/hooks/use-pipeline-visualization.ts` |
| **Type** | Custom React Hook |
| **Purpose** | Derive PipelineNodeState array from pipelineStore for visualization rendering |

**Parameters**:
```ts
interface UsePipelineVisualizationOptions {
  taskId: string;
}
```

**Return Value**:
```ts
interface UsePipelineVisualizationReturn {
  nodes: PipelineNodeState[];
  isActive: boolean;
  iteration: number;
}
```

**Implementation Logic**:
```ts
export function usePipelineVisualization({ taskId }: UsePipelineVisualizationOptions) {
  const pipelineRun = usePipelineStore((s) => s.pipelineRuns.get(taskId));
  const phaseTimings = usePipelineStore((s) => s.phaseTimings.get(taskId));

  const nodes: PipelineNodeState[] = useMemo(() => {
    return PIPELINE_NODES.map((config) => {
      const timing = phaseTimings?.[config.phase];
      const status = deriveNodeStatus(config, pipelineRun);

      return {
        phase: config.phase,
        status,
        startedAt: timing?.startedAt,
        completedAt: timing?.completedAt,
        duration: timing?.duration,
      };
    });
  }, [pipelineRun, phaseTimings]);

  return {
    nodes,
    isActive: pipelineRun?.status === "running",
    iteration: pipelineRun?.iteration ?? 0,
  };
}

function deriveNodeStatus(
  config: PipelineNodeConfig,
  pipelineRun: PipelineRunState | undefined
): NodeStatus {
  if (!pipelineRun) return "pending";

  const currentPhase = pipelineRun.phase;
  const nodeIndex = PIPELINE_NODES.findIndex((n) => n.phase === config.phase);
  const activeIndex = PIPELINE_NODES.findIndex((n) =>
    n.serverPhases.includes(currentPhase)
  );

  // Special case: "plan" node has no direct server phase
  // It completes when planning finishes (active moves past it)
  if (config.phase === "plan") {
    if (activeIndex > nodeIndex) return "completed";
    if (currentPhase === "planning") return "pending"; // plan not yet done
    return "pending";
  }

  // Terminal states
  if (pipelineRun.status === "failed") {
    if (nodeIndex === activeIndex) return "failed";
    if (nodeIndex < activeIndex) return "completed";
    return "pending";
  }

  if (pipelineRun.status === "cancelled") return "pending";

  // Normal flow
  if (nodeIndex < activeIndex) return "completed";
  if (nodeIndex === activeIndex) return "active";
  return "pending";
}
```

---

## Updated Components (from prior UOWs)

### BottomDock (Updated)

| Field | Value |
|-------|-------|
| **File** | `src/components/layout/bottom-dock.tsx` |
| **Original UOW** | UOW-01 (empty shell) |
| **UOW-05 Changes** | Wire AgentLogPanel, add collapse/expand, resize handle, activity indicator |

**Updated State**:
```ts
// Reads from uiStore:
const isExpanded = useUIStore((s) => s.isLogPanelExpanded);
const panelHeight = useUIStore((s) => s.logPanelHeight);
const togglePanel = useUIStore((s) => s.toggleLogPanel);
const setPanelHeight = useUIStore((s) => s.setLogPanelHeight);

// Reads from pipelineStore:
const hasRunningPipeline = usePipelineStore((s) =>
  Array.from(s.pipelineRuns.values()).some((run) => run.status === "running")
);
```

**Updated Rendering**:
```tsx
return (
  <motion.div
    className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background"
    animate={{ height: isExpanded ? panelHeight : LOG_PANEL_COLLAPSED_HEIGHT }}
    transition={{ type: "spring", stiffness: 300, damping: 30 }}
  >
    {/* Resize handle (only when expanded) */}
    {isExpanded && (
      <div
        className="flex h-2 cursor-row-resize items-center justify-center"
        onMouseDown={handleResizeStart}
        onDoubleClick={togglePanel}
      >
        <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
      </div>
    )}

    {/* Toggle bar */}
    <div className="flex h-9 items-center justify-between border-b px-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Agent Logs</span>
        {hasRunningPipeline && !isExpanded && (
          <PulseDot isActive color={getActiveAgentColor()} />
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={togglePanel}
        aria-label={isExpanded ? "Collapse log panel" : "Expand log panel"}
      >
        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
      </Button>
    </div>

    {/* Panel content (only when expanded) */}
    {isExpanded && (
      <div className="flex-1 overflow-hidden" style={{ height: panelHeight - LOG_PANEL_COLLAPSED_HEIGHT - 8 }}>
        <AgentLogPanel />
      </div>
    )}
  </motion.div>
);
```

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

**Business Rules**: BR-05-008, BR-05-011, BR-05-016

---

### TaskDetailView (Updated)

| Field | Value |
|-------|-------|
| **File** | `src/components/task/task-detail-view.tsx` |
| **Original UOW** | UOW-03 (placeholder slots) |
| **UOW-05 Changes** | Replace pipeline placeholder with PipelineVisualization, activate useSSE, set activeLogTaskId |

**Updated Logic**:
```tsx
// UOW-05 additions:
const setActiveLogTaskId = useUIStore((s) => s.setActiveLogTaskId);

// Activate SSE connection for live pipeline updates
const { isConnected } = useSSE({ taskId, enabled: true });

// Set active log task on mount/unmount
useEffect(() => {
  setActiveLogTaskId(taskId);
  return () => setActiveLogTaskId(null);
}, [taskId, setActiveLogTaskId]);

// Fetch pipeline status on mount (hydrate store from server)
useEffect(() => {
  async function hydratePipeline() {
    const response = await fetch(`/api/pipeline/${taskId}/status`);
    if (response.ok) {
      const data = await response.json();
      if (data.status !== "none") {
        pipelineStore.hydratePipelineRun(taskId, data);
      }
    }
  }
  hydratePipeline();
}, [taskId]);
```

**Updated Layout** (replacing placeholder):
```tsx
{/* Pipeline Visualization -- was placeholder in UOW-03 */}
<div className="rounded-lg border bg-card p-4">
  <PipelineVisualization taskId={taskId} />
</div>

{/* ... rest of detail view (title, description, subtasks) ... */}

{/* Pipeline Controls (UOW-04) */}
<PipelineControls taskId={taskId} />
```

---

## Component Dependency Tree (UOW-05 Scope)

```
TaskDetailView (UOW-03, updated)
  |
  +-- PipelineVisualization (NEW)
  |     |
  |     +-- PipelineNode (x5) (NEW)
  |     |     |
  |     |     +-- PipelineTimer (NEW)
  |     |     +-- Lucide Icons (CheckCircle2, XCircle, FileText, ListChecks, Code2, Search)
  |     |     +-- Framer Motion (pulse, icon swap)
  |     |
  |     +-- PipelineConnector (x4) (NEW)
  |           +-- Framer Motion (width animation)
  |
  +-- PipelineControls (UOW-04, unchanged)
  |
  +-- useSSE (UOW-04, activated here)
  |
  +-- usePipelineVisualization (NEW hook)

BottomDock (UOW-01, updated)
  |
  +-- AgentLogPanel (NEW)
  |     |
  |     +-- shadcn/ui Tabs
  |     +-- AgentLogTab (x3) (NEW)
  |           |
  |           +-- useAutoScroll (NEW hook)
  |           +-- LogEntry (xN) (NEW)
  |                 |
  |                 +-- useTypingEffect (NEW hook)
  |
  +-- PulseDot (UOW-03, reused)
  +-- Framer Motion (height animation)
  +-- Resize handle (built-in)
```

---

## Zustand Store Usage by Component

| Component | pipelineStore | uiStore | taskStore | Notes |
|-----------|--------------|---------|-----------|-------|
| PipelineVisualization | read (pipelineRuns, phaseTimings) | - | - | Via usePipelineVisualization hook |
| PipelineNode | (via props from parent) | - | - | Pure display component |
| PipelineConnector | (via props from parent) | - | - | Pure display component |
| PipelineTimer | (via props from parent) | - | - | Has local timer state |
| AgentLogPanel | read (agentLogs, pipelineRuns) | read (activeLogTaskId) | - | Tab management |
| AgentLogTab | (via props from parent) | - | - | Scroll management |
| LogEntry | (via props from parent) | - | - | Typing effect |
| BottomDock | read (any running?) | read/write (isExpanded, height) | - | Layout management |
| TaskDetailView | write (hydratePipelineRun) | write (activeLogTaskId) | read (task) | SSE activation |

---

## shadcn/ui Components Required (UOW-05)

| Component | Used By | Purpose |
|-----------|---------|---------|
| Tabs, TabsList, TabsTrigger, TabsContent | AgentLogPanel | Agent tab switching |
| Button | BottomDock | Collapse/expand toggle |
| ScrollArea | AgentLogTab | Scrollable log content (optional, may use native overflow-y-auto) |

---

## Third-Party Library Integration

### Framer Motion

| Component | Animation |
|-----------|-----------|
| PipelineNode | Scale pulse when active, icon swap with AnimatePresence |
| PipelineConnector | Width fill animation (0% -> 100%) |
| BottomDock | Height spring animation for collapse/expand |
| LogEntry | (no direct Framer Motion; uses CSS for cursor blink) |

### Lucide Icons

| Icon | Used In | Purpose |
|------|---------|---------|
| FileText | PipelineNode (Spec) | Spec phase icon |
| ListChecks | PipelineNode (Plan) | Plan phase icon |
| Code2 | PipelineNode (Code) | Code phase icon |
| Search | PipelineNode (Review) | Review phase icon |
| CheckCircle2 | PipelineNode (completed) | Completed state icon |
| XCircle | PipelineNode (failed) | Failed state icon |
| ChevronUp | BottomDock | Expand panel toggle |
| ChevronDown | BottomDock | Collapse panel toggle |
| ArrowDown | AgentLogTab | "Jump to latest" button icon |
| Brain | AgentLogPanel tab | Planner agent tab icon |
