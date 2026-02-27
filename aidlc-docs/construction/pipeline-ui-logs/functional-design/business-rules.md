# Business Rules -- UOW-05: Pipeline UI & Agent Logs

## Overview

All business rules for UOW-05 are listed below with unique IDs (BR-05-XXX), rule statement, validation logic, and error messages. Rules are grouped by domain: Pipeline Visualization, Agent Log Panel, Typing Effect & Streaming, Auto-Scroll, Panel Layout. All rules are client-side (frontend enforcement).

---

## Pipeline Visualization Rules

### BR-05-001: Fixed 5-Node Pipeline Layout

| Field | Value |
|-------|-------|
| **Rule** | Pipeline visualization renders exactly 5 nodes in fixed order: Spec, Plan, Code, Review, Done |
| **Validation** | Nodes defined as a constant array. No dynamic addition/removal. Layout is always horizontal, left-to-right. |
| **Enforcement** | Client-side (PipelineVisualization component, constant `PIPELINE_NODES`) |
| **Stories** | US-033 |

### BR-05-002: Node Status Colors

| Field | Value |
|-------|-------|
| **Rule** | Node visual state determined by status with specific color mapping |
| **Validation** | Status-to-color map: `pending` = gray (#6B7280), `active:planning` = amber (#F59E0B), `active:coding` = blue (#3B82F6), `active:reviewing` = purple (#8B5CF6), `completed` = green (#22C55E), `failed` = red (#EF4444). Applied to border, icon tint, and background opacity. |
| **Enforcement** | Client-side (PipelineNode component, `NODE_STATUS_COLORS` constant) |
| **Stories** | US-033, US-034, US-036 |

### BR-05-003: Single Active Node Constraint

| Field | Value |
|-------|-------|
| **Rule** | Only one node can pulse (be in "active" state) at a time |
| **Validation** | PipelineVisualization derives node statuses from a single `pipelineRun.phase` value. The mapping function guarantees at most one node maps to "active". All nodes before the active node are "completed"; all after are "pending". |
| **Enforcement** | Client-side (PipelineVisualization status derivation logic) |
| **Stories** | US-034 |

### BR-05-004: Phase Timing Format

| Field | Value |
|-------|-------|
| **Rule** | Phase timing display: MM:SS while active (live counter), final duration when complete |
| **Validation** | Active phase: `setInterval(1000ms)` updates display as `MM:SS` with leading zeros (e.g., "00:05", "01:23"). Completed phase < 60s: `Xs` format (e.g., "12s"). Completed phase >= 60s: `M:SS` format (e.g., "1:45"). Pending phase: hidden (no display). |
| **Enforcement** | Client-side (PipelineTimer component) |
| **Stories** | US-035 |

### BR-05-005: Completed Node Checkmark

| Field | Value |
|-------|-------|
| **Rule** | Completed nodes show CheckCircle2 icon; failed nodes show XCircle icon |
| **Validation** | On status change to "completed": replace default phase icon with Lucide `CheckCircle2` (green). On status change to "failed": replace with Lucide `XCircle` (red). Icon transition uses Framer Motion `AnimatePresence` for smooth swap. |
| **Enforcement** | Client-side (PipelineNode component) |
| **Stories** | US-036 |

---

## Agent Log Panel Rules

### BR-05-006: Agent Tab Colors

| Field | Value |
|-------|-------|
| **Rule** | Each agent tab has a fixed accent color: Planner = #F59E0B (amber), Coder = #3B82F6 (blue), Reviewer = #8B5CF6 (purple) |
| **Validation** | Tab underline, log text color, and activity indicator dot all use the agent's assigned color. Defined as `AGENT_TAB_COLORS` constant. |
| **Enforcement** | Client-side (AgentLogPanel, AgentLogTab, LogEntry components) |
| **Stories** | US-041 |

### BR-05-007: Auto-Scroll Pause Threshold

| Field | Value |
|-------|-------|
| **Rule** | Auto-scroll pauses when user scrolls up more than 50px from bottom; resumes on scroll to bottom or new tab selection |
| **Validation** | useAutoScroll hook checks `scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight > 50`. If true: `isAtBottom = false`, auto-scroll paused, "Jump to latest" button shown. Resumes when: (a) user scrolls back to bottom (<= 50px threshold), (b) user clicks "Jump to latest", or (c) user switches tabs. |
| **Enforcement** | Client-side (useAutoScroll hook) |
| **Stories** | US-040 |

### BR-05-008: Log Panel Height Constraints

| Field | Value |
|-------|-------|
| **Rule** | Log panel minimum height: 36px (collapsed), maximum: 50vh, default expanded: 300px |
| **Validation** | On resize drag: `Math.max(36, Math.min(window.innerHeight * 0.5, newHeight))`. Collapsed state is exactly 36px (shows only toggle bar). Default expanded is 300px. Height persisted in `uiStore.logPanelHeight`. |
| **Enforcement** | Client-side (BottomDock resize handler) |
| **Stories** | US-037 |

### BR-05-009: Log Entry Timestamp Format

| Field | Value |
|-------|-------|
| **Rule** | Log entries include timestamp prefix in HH:MM:SS format |
| **Validation** | Each LogEntry renders timestamp as `[HH:MM:SS]` prefix in muted color (text-muted-foreground). Time derived from `logEntry.timestamp` (Unix ms) converted to local time via `new Date(timestamp).toLocaleTimeString('en-US', { hour12: false })`. |
| **Enforcement** | Client-side (LogEntry component) |
| **Stories** | US-041 |

### BR-05-010: Empty Tab Placeholder

| Field | Value |
|-------|-------|
| **Rule** | Empty tab state shows "Waiting for [agent name] to start..." placeholder |
| **Validation** | When `agentLogs[taskId]?.[agentType]` is empty or undefined: render centered placeholder text in muted color. Agent name is the display label: "Planner", "Coder", or "Reviewer". If no pipeline has ever run for the task: show "No logs yet -- start a pipeline to see agent output." |
| **Enforcement** | Client-side (AgentLogTab component) |
| **Stories** | US-038 |

### BR-05-011: Panel Resize via Drag Handle

| Field | Value |
|-------|-------|
| **Rule** | Panel height adjustable via vertical drag handle at top of expanded panel |
| **Validation** | Drag handle: horizontal bar (100% width, 8px hit area, 4px visible grip). Cursor: `row-resize`. On drag: update height in real-time (no debounce). On drag end: persist height to `uiStore.logPanelHeight`. Double-click: toggle between collapsed (36px) and last expanded height. |
| **Enforcement** | Client-side (BottomDock resize handler) |
| **Stories** | US-037 |

---

## Typing Effect & Streaming Rules

### BR-05-012: Typing Effect Speed

| Field | Value |
|-------|-------|
| **Rule** | Typing effect speed: approximately 30 characters per animation frame at ~50ms intervals |
| **Validation** | useTypingEffect hook uses `requestAnimationFrame` loop. Each iteration checks if >= 50ms elapsed since last append. If yes: append up to 30 characters from remaining text. Effective speed: ~600 characters/second. When all characters displayed: stop rAF loop, mark `isStreaming = false`. |
| **Enforcement** | Client-side (useTypingEffect hook) |
| **Stories** | US-039 |

### BR-05-013: Blinking Cursor During Streaming

| Field | Value |
|-------|-------|
| **Rule** | A blinking cursor appears at the end of text while streaming is active |
| **Validation** | When `isStreaming === true`: render a `|` character after displayed text with CSS `animation: blink 1s step-end infinite`. When `isStreaming === false`: cursor removed. Cursor color matches agent color. |
| **Enforcement** | Client-side (LogEntry component) |
| **Stories** | US-039 |

### BR-05-014: Log Entry Grouping

| Field | Value |
|-------|-------|
| **Rule** | Consecutive SSE chunks from the same agent within 500ms are grouped into a single LogEntry |
| **Validation** | When pipelineStore.appendLog is called: check timestamp of last entry for that agent. If `timestamp - lastEntry.timestamp < 500`: append chunk to last entry's content (extend typing). If >= 500ms gap: create new LogEntry with new timestamp. |
| **Enforcement** | Client-side (pipelineStore.appendLog action) |
| **Stories** | US-039, US-041 |

---

## New Content Indicator Rules

### BR-05-015: Unread Tab Indicator

| Field | Value |
|-------|-------|
| **Rule** | Tabs receiving new log content while not selected show a colored dot indicator |
| **Validation** | AgentLogPanel tracks `unreadTabs: Set<AgentType>` in local state. On log append to non-active tab: add agentType to unreadTabs. On tab switch: remove newly selected tab from unreadTabs. Dot rendered: 6px circle in agent's color, positioned top-right of tab label. |
| **Enforcement** | Client-side (AgentLogPanel component local state) |
| **Stories** | US-038 |

### BR-05-016: Activity Indicator on Collapsed Panel

| Field | Value |
|-------|-------|
| **Rule** | When panel is collapsed and a pipeline is running, show pulsing activity dot on toggle bar |
| **Validation** | BottomDock reads `pipelineStore`: `Array.from(pipelineRuns.values()).some(run => run.status === "running")`. If true: render PulseDot (from UOW-03) in the toggle bar, colored by the active agent's tab color. |
| **Enforcement** | Client-side (BottomDock component) |
| **Stories** | US-037 |

---

## Monospace & Styling Rules

### BR-05-017: Log Text Font

| Field | Value |
|-------|-------|
| **Rule** | All log entry text renders in monospace font |
| **Validation** | AgentLogTab and LogEntry components apply `font-mono` class (Tailwind). Timestamp prefix included in monospace. Font size: `text-sm` (14px). Line height: `leading-relaxed` (1.625). |
| **Enforcement** | Client-side (AgentLogTab, LogEntry components) |
| **Stories** | US-041 |

---

## Rules Summary Matrix

| Rule ID | Domain | Type | Enforcement |
|---------|--------|------|------------|
| BR-05-001 | Pipeline Visualization | Layout constraint | Client |
| BR-05-002 | Pipeline Visualization | Color mapping | Client |
| BR-05-003 | Pipeline Visualization | State constraint | Client |
| BR-05-004 | Pipeline Visualization | Display format | Client |
| BR-05-005 | Pipeline Visualization | Icon mapping | Client |
| BR-05-006 | Agent Log Panel | Color mapping | Client |
| BR-05-007 | Agent Log Panel | Scroll behavior | Client |
| BR-05-008 | Agent Log Panel | Layout constraint | Client |
| BR-05-009 | Agent Log Panel | Display format | Client |
| BR-05-010 | Agent Log Panel | Empty state | Client |
| BR-05-011 | Agent Log Panel | Resize behavior | Client |
| BR-05-012 | Typing Effect | Animation speed | Client |
| BR-05-013 | Typing Effect | Visual indicator | Client |
| BR-05-014 | Typing Effect | Grouping logic | Client (store) |
| BR-05-015 | Agent Log Panel | Notification | Client |
| BR-05-016 | Agent Log Panel | Activity indicator | Client |
| BR-05-017 | Agent Log Panel | Typography | Client |
