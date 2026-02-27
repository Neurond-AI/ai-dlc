# NFR Requirements -- UOW-05: Pipeline UI & Agent Logs

## Overview

Non-functional requirements for UOW-05 scoped to: pipeline flow visualization, agent log panel with streaming text, SSE event consumption, typing effect, auto-scroll, phase timing display, and BottomDock integration. Each NFR has a unique ID (NFR-05-XXX), measurable target, verification method, and SECURITY rule mapping where applicable.

**Baseline**: UOW-01 NFRs (NFR-01-001 through NFR-01-023) apply as inherited requirements. UOW-04 NFRs (NFR-04-001 through NFR-04-018) apply for all SSE and pipeline state concerns. This document covers ADDITIONAL unit-specific concerns introduced by real-time UI rendering, animation performance, and log display at scale.

---

## Performance

### NFR-05-001: Animation Frame Rate

| Field | Value |
|-------|-------|
| **Category** | Performance |
| **Requirement** | All Framer Motion animations must maintain 60 FPS on mid-range hardware |
| **Metric/Target** | Pipeline node pulse animation, connector fill animation, panel expand/collapse, and log panel resize must all sustain >= 55 FPS (measured via Chrome DevTools Performance panel). No dropped frames during steady-state animation. Mid-range hardware defined as: 4-core CPU, 8GB RAM, integrated GPU. |
| **SECURITY Mapping** | N/A |
| **Verification** | Open TaskDetailView with active pipeline. Record 10-second Performance trace in Chrome DevTools. Frame rate chart must show >= 55 FPS during pulse animation. No long frames (> 50ms) caused by animation logic. Test on Chrome DevTools CPU 4x slowdown throttle to simulate mid-range hardware. |

### NFR-05-002: SSE Event Processing Latency

| Field | Value |
|-------|-------|
| **Category** | Performance |
| **Requirement** | SSE event processing from EventSource.onmessage to Zustand store update must complete within 16ms |
| **Metric/Target** | Time from `event.data` JSON parse to `pipelineStore.appendLog()` completion < 16ms (one animation frame budget). Ensures UI updates are batched into the next paint without frame drops. |
| **SECURITY Mapping** | N/A |
| **Verification** | Instrument `useSSE` hook with `performance.mark()` before parse and after store dispatch. Measure delta for 100 consecutive agent-log events. P95 processing time must be < 16ms. No synchronous blocking between parse and dispatch. |

### NFR-05-003: Log Rendering at Scale

| Field | Value |
|-------|-------|
| **Category** | Performance |
| **Requirement** | Agent log panel must render smoothly with up to 5,000 log entries per agent tab |
| **Metric/Target** | Scrolling through 5,000 log entries at 60 FPS. No visible jank when switching between agent tabs with large log histories. Initial render of tab with 5,000 entries < 200ms. Memory usage for log entries < 50MB per agent tab. |
| **SECURITY Mapping** | N/A |
| **Verification** | Seed pipelineStore with 5,000 log entries for the coder agent. Open AgentLogPanel on coder tab. Scroll rapidly up and down -- Chrome DevTools Performance panel shows >= 55 FPS. Switch to planner tab (empty) and back to coder (5,000 entries) -- tab switch completes in < 200ms. Monitor DevTools Memory tab -- heap delta < 50MB for log data. |

### NFR-05-004: Typing Effect Performance

| Field | Value |
|-------|-------|
| **Category** | Performance |
| **Requirement** | Typing effect must not cause layout thrashing or excessive re-renders |
| **Metric/Target** | `useTypingEffect` hook uses `requestAnimationFrame` for character reveal. Maximum 1 React re-render per 50ms interval (batched updates). No forced reflow during character append. Text container uses `will-change: contents` or equivalent optimization. |
| **SECURITY Mapping** | N/A |
| **Verification** | Open AgentLogPanel during active pipeline streaming. React DevTools Profiler shows LogEntry component re-renders at <= 20/second (50ms interval). Chrome DevTools Performance panel shows no "Layout Shift" or "Forced Reflow" events attributed to typing effect. CPU usage from typing effect < 5% on mid-range hardware. |

### NFR-05-005: Pipeline Visualization Render Time

| Field | Value |
|-------|-------|
| **Category** | Performance |
| **Requirement** | PipelineVisualization component must render within 100ms on mount |
| **Metric/Target** | Time from component mount to first visible paint of all 5 nodes + 4 connectors < 100ms. Subsequent phase-change re-renders < 50ms. |
| **SECURITY Mapping** | N/A |
| **Verification** | React DevTools Profiler: measure PipelineVisualization mount time. Must be < 100ms. Trigger a phase-change event and measure re-render time -- must be < 50ms. No unnecessary re-renders of nodes whose state did not change (verify via React.memo or selector equality). |

### NFR-05-006: No Layout Shifts from Typing Effect

| Field | Value |
|-------|-------|
| **Category** | Performance |
| **Requirement** | Typing effect must not cause layout shifts |
| **Metric/Target** | CLS (Cumulative Layout Shift) contribution from log panel typing effect = 0. Log container has fixed or min-height. New characters appended without reflowing surrounding content. Auto-scroll does not trigger layout recalculation of elements above viewport. |
| **SECURITY Mapping** | N/A |
| **Verification** | Run Lighthouse on page during pipeline execution. CLS must remain < 0.1 (good threshold). Visually verify: pipeline visualization above log panel does not shift/jump as log content grows. Log container uses `overflow-y: auto` with stable dimensions. |

---

## Security

### NFR-05-007: XSS Prevention in Log Output

| Field | Value |
|-------|-------|
| **Category** | Security |
| **Requirement** | Agent log output must be rendered safely without executing embedded scripts or HTML |
| **Metric/Target** | All log content rendered via React's JSX text interpolation (`{content}`) which auto-escapes HTML. No use of `dangerouslySetInnerHTML` in LogEntry, AgentLogTab, or any log rendering component. If markdown rendering is added, use a sanitized renderer (e.g., react-markdown with rehype-sanitize). |
| **SECURITY Mapping** | SECURITY-05 (Input Validation) |
| **Verification** | Inject test payloads into pipelineStore.agentLogs: `<script>alert('xss')</script>`, `<img onerror="alert(1)" src=x>`, `javascript:alert(1)`. Render AgentLogPanel. No script execution, no broken HTML rendering. All payloads display as literal text. Inspect DOM -- no unescaped HTML elements. |

### NFR-05-008: SSE Connection Authentication

| Field | Value |
|-------|-------|
| **Category** | Security |
| **Requirement** | SSE EventSource connections must require valid session authentication |
| **Metric/Target** | `GET /api/sse/[taskId]` validates session cookie before establishing SSE connection. Unauthenticated requests return 401. SSE endpoint also validates task ownership (task.userId === session.userId). Unauthorized access returns 404 (prevents task enumeration). |
| **SECURITY Mapping** | SECURITY-08 (Application-Level Access Control) |
| **Verification** | Attempt SSE connection without session cookie -- expect 401 response (not SSE stream). Attempt SSE connection with valid session for a different user's task -- expect 404. Attempt SSE connection with valid session for own task -- expect 200 with `text/event-stream` content type. Note: EventSource API sends cookies automatically (same-origin). |

### NFR-05-009: No Sensitive Data in SSE Events

| Field | Value |
|-------|-------|
| **Category** | Security |
| **Requirement** | SSE events must not contain API keys, session tokens, or PII |
| **Metric/Target** | SSE event payloads contain only: agent name, text chunks, phase names, timestamps, task IDs, status enums. No `sk-ant-*` patterns, no email addresses, no passwords, no session tokens in any SSE event data. |
| **SECURITY Mapping** | SECURITY-12 (Authentication and Credential Management) |
| **Verification** | Run a full pipeline. Capture all SSE events via browser DevTools EventStream tab. Search captured data for: `sk-ant-`, `@` (email pattern), `password`, `session`, `cookie`, `token`. Zero matches. All event payloads conform to typed SSE event schema. |

---

## Reliability

### NFR-05-010: SSE Reconnection with State Recovery

| Field | Value |
|-------|-------|
| **Category** | Reliability |
| **Requirement** | On SSE reconnection, client must recover current pipeline state from server |
| **Metric/Target** | After SSE reconnect (via useSSE auto-reconnect from NFR-04-011), client fetches `GET /api/pipeline/[taskId]/status` to populate pipelineStore with current phase, status, and iteration. Any log entries missed during disconnect are not recoverable (accepted trade-off for MVP). Pipeline visualization shows correct current state within 2 seconds of reconnect. |
| **SECURITY Mapping** | N/A |
| **Verification** | Start pipeline. During coding phase, toggle DevTools Network to offline for 5 seconds, then back online. Observe: (1) SSE reconnects within backoff window, (2) PipelineVisualization shows correct current phase within 2s, (3) no duplicate log entries. AgentLogPanel may show gap in logs (acceptable). |

### NFR-05-011: Log Buffer Overflow Protection

| Field | Value |
|-------|-------|
| **Category** | Reliability |
| **Requirement** | Agent log buffer must cap at 10,000 entries per agent per pipeline run |
| **Metric/Target** | When `agentLogs[taskId][agent].length >= 10,000`, new entries overwrite oldest entries (circular buffer). UI shows indicator: "Showing latest 10,000 entries". Memory usage remains bounded. |
| **SECURITY Mapping** | N/A |
| **Verification** | Mock rapid SSE agent-log events (10,000+ in quick succession). Verify agentLogs array length never exceeds 10,000. Verify oldest entries are removed. Monitor memory -- no unbounded growth. UI shows truncation indicator when limit reached. |

### NFR-05-012: Graceful Handling of Malformed SSE Events

| Field | Value |
|-------|-------|
| **Category** | Reliability |
| **Requirement** | Client must handle malformed or unexpected SSE event data without crashing |
| **Metric/Target** | If `JSON.parse(event.data)` throws or event schema validation fails, error is caught and logged to console. No React error boundary triggered. No store corruption. Event is silently dropped. Pipeline visualization continues with last known good state. |
| **SECURITY Mapping** | SECURITY-15 (Exception Handling and Fail-Safe Defaults) |
| **Verification** | Inject malformed SSE data: (1) invalid JSON string, (2) valid JSON but missing required fields, (3) unexpected event type. For each: verify no uncaught exception, no React error boundary, no blank screen. Console shows warning-level log. Pipeline UI remains functional. |

### NFR-05-013: Log Preservation on Tab Switch

| Field | Value |
|-------|-------|
| **Category** | Reliability |
| **Requirement** | Log panel must preserve content when switching between agent tabs |
| **Metric/Target** | Switching from Planner tab to Coder tab and back preserves full planner log content. No re-fetch from server. Content stored in Zustand pipelineStore (in-memory). Scroll position preserved per tab. |
| **SECURITY Mapping** | N/A |
| **Verification** | During pipeline: view planner log, scroll to middle, switch to coder tab, switch back. Planner content intact. Scroll position restored to previous position. No loading spinner on tab switch. No network request on tab switch (verify in DevTools Network tab). |

### NFR-05-014: Typing Effect Graceful Degradation

| Field | Value |
|-------|-------|
| **Category** | Reliability |
| **Requirement** | Typing effect must degrade gracefully under frame budget pressure |
| **Metric/Target** | If `requestAnimationFrame` callback measures frame time > 32ms (two frames dropped), typing effect switches to immediate text append (skip character-by-character animation). Prevents cascading jank. Resumes animation when frame budget normalizes. |
| **SECURITY Mapping** | N/A |
| **Verification** | Simulate CPU throttle (Chrome DevTools Performance > CPU 6x slowdown). During streaming, observe typing effect. If frames drop, text should appear in chunks rather than individual characters. No frozen UI. Content completeness identical regardless of animation mode. |

---

## Usability

### NFR-05-015: Auto-Scroll Behavior

| Field | Value |
|-------|-------|
| **Category** | Usability |
| **Requirement** | Agent log panel must auto-scroll to latest entry, with manual override |
| **Metric/Target** | Auto-scroll active when user is within 50px of scroll bottom. If user scrolls up (> 50px from bottom), auto-scroll pauses and "Jump to latest" button appears. Clicking "Jump to latest" scrolls to bottom and resumes auto-scroll. On tab switch, scroll resets to bottom. Scroll behavior is smooth (CSS `scroll-behavior: smooth`). |
| **SECURITY Mapping** | N/A |
| **Verification** | Open AgentLogPanel during active streaming. Verify new entries auto-scroll into view. Scroll up manually -- verify auto-scroll stops and "Jump to latest" button appears (within 200ms of crossing threshold). Click "Jump to latest" -- verify instant scroll to bottom and auto-scroll resumes. Switch tabs -- verify scroll position resets to bottom. |

### NFR-05-016: Tab Switching Responsiveness

| Field | Value |
|-------|-------|
| **Category** | Usability |
| **Requirement** | Switching between agent tabs must complete within 100ms |
| **Metric/Target** | Click on Planner/Coder/Reviewer tab -- content swap completes in < 100ms. Tab underline animation smooth (Framer Motion layout animation). Unread indicator dot clears immediately on tab switch. No flash of empty content during transition. |
| **SECURITY Mapping** | N/A |
| **Verification** | During active pipeline with logs in all 3 tabs, rapidly switch between tabs. Each switch renders new tab content in < 100ms (measure via React DevTools Profiler). No blank flash between tab transitions. Unread dots clear on click. |

### NFR-05-017: Panel Resize Responsiveness

| Field | Value |
|-------|-------|
| **Category** | Usability |
| **Requirement** | BottomDock resize drag must track mouse position in real-time without lag |
| **Metric/Target** | Drag handle updates panel height on every `mousemove` event. No visible lag between mouse position and panel edge. Height clamped between 36px (collapsed) and 50vh. Double-click toggles between collapsed (36px) and default (300px). Panel height persisted in uiStore across page navigations. |
| **SECURITY Mapping** | N/A |
| **Verification** | Drag resize handle up and down. Panel edge follows mouse without visible delay (< 1 frame lag). Drag to extremes -- verify clamping at 36px and 50vh. Double-click handle -- verify toggle between 36px and 300px. Navigate to another page and back -- verify panel height is restored. |

### NFR-05-018: Collapsed Panel Activity Indicator

| Field | Value |
|-------|-------|
| **Category** | Usability |
| **Requirement** | When log panel is collapsed, a pulsing indicator must show if a pipeline is actively streaming |
| **Metric/Target** | Collapsed panel (36px bar) shows animated dot when any pipelineRun has status "running". Dot color matches the currently active agent's tab color (amber/blue/purple). Dot animation: CSS pulse (scale 1 -> 1.5 -> 1, 1.5s loop). No activity indicator when no pipeline is running. |
| **SECURITY Mapping** | N/A |
| **Verification** | Collapse panel. Start pipeline -- verify pulsing dot appears on collapsed bar. Dot color changes as active agent changes (amber during planner, blue during coder, purple during reviewer). Pipeline completes -- verify dot disappears. No false positives when pipeline is idle. |

### NFR-05-019: Responsive Pipeline Visualization

| Field | Value |
|-------|-------|
| **Category** | Usability |
| **Requirement** | Pipeline visualization must be readable at all breakpoints |
| **Metric/Target** | Desktop (1280px+): full horizontal pipeline with labels and timing. Tablet (768px+): compact nodes, abbreviated labels. Mobile (375px+): horizontal row with icon-only (no labels). No truncated or overlapping text at any breakpoint. |
| **SECURITY Mapping** | N/A |
| **Verification** | Resize browser to 1280px, 768px, 375px. At each breakpoint: all pipeline nodes visible, labels readable (or icon-only on mobile), status indicators (colors, icons) distinguishable. No content hidden without scroll affordance. |

### NFR-05-020: Keyboard Accessibility for Log Panel

| Field | Value |
|-------|-------|
| **Category** | Usability |
| **Requirement** | Log panel must be operable via keyboard |
| **Metric/Target** | Tab key navigates between agent tabs. Enter/Space activates selected tab. Escape collapses panel if expanded. Panel content is scrollable via arrow keys when focused. "Jump to latest" button is focusable and activatable via keyboard. All interactive elements have visible focus indicators (2px ring). |
| **SECURITY Mapping** | N/A |
| **Verification** | Navigate to log panel using only keyboard. Tab through agent tabs -- verify focus ring visible on each. Enter to switch tabs. Arrow keys to scroll log content. Escape to collapse panel. Tab to "Jump to latest" button and activate with Enter. No focus traps. Screen reader announces tab names and active state. |

### NFR-05-021: Color Contrast Compliance

| Field | Value |
|-------|-------|
| **Category** | Usability |
| **Requirement** | Agent status colors must meet WCAG 2.1 AA contrast requirements |
| **Metric/Target** | All text on colored backgrounds has contrast ratio >= 4.5:1 (normal text) or >= 3:1 (large text). Agent phase colors verified against both light and dark backgrounds. Status indicators (running, complete, error) distinguishable by shape/icon in addition to color (not color-only). |
| **SECURITY Mapping** | N/A |
| **Verification** | Use Chrome DevTools Accessibility panel or axe-core to check contrast ratios for: agent tab labels, pipeline node labels, status text, log content text. All must pass AA (4.5:1 for body text). Verify status is conveyed by icon + color (accessible to colorblind users). |

---

## Maintainability

### NFR-05-022: Component Isolation

| Field | Value |
|-------|-------|
| **Category** | Maintainability |
| **Requirement** | Pipeline visualization components must be self-contained and independently testable |
| **Metric/Target** | `PipelineNode`, `PipelineConnector`, and `PipelineTimer` accept props only (no direct store access). Parent `PipelineVisualization` reads from store and passes props down. Each component can be rendered in isolation with mock props. No circular dependencies between pipeline components. |
| **SECURITY Mapping** | N/A |
| **Verification** | Inspect component files. `PipelineNode`, `PipelineConnector`, `PipelineTimer` have zero store imports. Only `PipelineVisualization` imports from `pipelineStore`. Run `npx madge --circular src/components/pipeline/` -- zero circular dependencies. Components render correctly with mock props in Storybook or isolated test. |

### NFR-05-023: SSE Event Type Safety

| Field | Value |
|-------|-------|
| **Category** | Maintainability |
| **Requirement** | All SSE event types must be defined as TypeScript discriminated unions |
| **Metric/Target** | `types/sse.ts` exports a discriminated union type: `SSEEvent = AgentLogEvent | PhaseChangeEvent | TaskStatusEvent | ErrorEvent | PipelineCompleteEvent`. Each variant has `type` as literal string discriminant. `useSSE` hook uses exhaustive switch on `event.type`. Adding a new event type without handling it causes a TypeScript compiler error. |
| **SECURITY Mapping** | N/A |
| **Verification** | Inspect `types/sse.ts` for discriminated union. Inspect `useSSE` for exhaustive switch (or `assertNever` default case). Add a new event type to the union without adding a handler -- verify `npx tsc --noEmit` fails with exhaustiveness error. |

### NFR-05-024: Animation Constants Centralized

| Field | Value |
|-------|-------|
| **Category** | Maintainability |
| **Requirement** | All animation durations, easing curves, and timing constants must be centralized |
| **Metric/Target** | Animation config file (`lib/constants/animations.ts`) exports all timing values: pulse duration (2s), connector fill duration (0.8s), panel expand spring config, typing effect interval (50ms), auto-scroll threshold (50px). No magic numbers in component files. All Framer Motion `transition` props reference centralized constants. |
| **SECURITY Mapping** | N/A |
| **Verification** | Search component files for hardcoded animation values (`duration:`, `delay:`, numeric transition values). All must reference imports from `lib/constants/animations.ts`. Animation config file contains all timing values with descriptive names and JSDoc comments. |

---

## SECURITY Compliance Matrix

Mapping of all 15 SECURITY baseline rules to UOW-05 applicability. Rules already fully covered by UOW-01 or UOW-04 baseline are marked "Inherited".

| SECURITY Rule | Rule Name | Applicable to UOW-05? | Implementation | NFR ID |
|---------------|-----------|----------------------|----------------|--------|
| SECURITY-01 | Encryption at Rest and in Transit | Inherited | UOW-01 baseline applies. No new data storage in UOW-05. SSE over HTTPS in production. | -- (UOW-01) |
| SECURITY-02 | Access Logging on Network Intermediaries | N/A | No new network infrastructure in UOW-05 scope. | -- |
| SECURITY-03 | Application-Level Logging | Inherited | UOW-04 structured logging applies to SSE events. Client-side console warnings for malformed events (NFR-05-012). | -- (UOW-04) |
| SECURITY-04 | HTTP Security Headers | Inherited | UOW-01 middleware applies to SSE endpoint. CSP `connect-src 'self'` allows same-origin SSE connections. | -- (UOW-01) |
| SECURITY-05 | Input Validation | Yes -- Extended | Agent log output rendered safely via React JSX auto-escaping (NFR-05-007). No dangerouslySetInnerHTML. SSE event data validated against typed schema before store dispatch. | NFR-05-007 |
| SECURITY-06 | Least-Privilege Access | Inherited | SSE endpoint scoped to authenticated user's tasks only (NFR-05-008). | NFR-05-008 |
| SECURITY-07 | Restrictive Network Configuration | N/A | No new network infrastructure. SSE uses existing HTTP connection. | -- |
| SECURITY-08 | Application-Level Access Control | Yes -- Extended | SSE connection requires session auth. Task ownership validated before stream established. Unauthorized access returns 404 (no enumeration). | NFR-05-008 |
| SECURITY-09 | Hardening and Misconfiguration Prevention | Inherited | UOW-01 baseline applies. No new error surfaces. Malformed SSE events handled gracefully (NFR-05-012). | NFR-05-012 |
| SECURITY-10 | Software Supply Chain Security | Inherited | No new dependencies in UOW-05. Framer Motion already included in UOW-01 stack. | -- (UOW-01) |
| SECURITY-11 | Secure Design Principles | Inherited | Log buffer overflow protection prevents resource exhaustion (NFR-05-011). | NFR-05-011 |
| SECURITY-12 | Authentication and Credential Management | Yes -- Extended | SSE events must not contain API keys, session tokens, or PII (NFR-05-009). No credentials in client-side log data. | NFR-05-009 |
| SECURITY-13 | Software and Data Integrity | Inherited | No new external resources. React auto-escaping ensures log output integrity. | -- |
| SECURITY-14 | Alerting and Monitoring | N/A | No new alerting in UOW-05 scope. Client-side errors logged to console. | -- |
| SECURITY-15 | Exception Handling and Fail-Safe Defaults | Yes -- Extended | Malformed SSE events caught and dropped without crashing UI (NFR-05-012). Log buffer capped to prevent memory exhaustion (NFR-05-011). React error boundaries protect pipeline visualization from rendering failures. | NFR-05-011, NFR-05-012 |

---

## NFR Summary Matrix

| NFR ID | Category | Short Description | Target | SECURITY Rule |
|--------|----------|------------------|--------|---------------|
| NFR-05-001 | Performance | Animation frame rate | >= 55 FPS on mid-range hardware | -- |
| NFR-05-002 | Performance | SSE event processing | < 16ms parse-to-store | -- |
| NFR-05-003 | Performance | Log rendering at scale | 5,000 entries at 60 FPS | -- |
| NFR-05-004 | Performance | Typing effect perf | <= 20 re-renders/sec, no layout thrash | -- |
| NFR-05-005 | Performance | Pipeline viz render | < 100ms mount, < 50ms re-render | -- |
| NFR-05-006 | Performance | No layout shifts | CLS = 0 from typing effect | -- |
| NFR-05-007 | Security | XSS in log output | React auto-escape, no dangerouslySetInnerHTML | SECURITY-05 |
| NFR-05-008 | Security | SSE auth | Session + ownership validation | SECURITY-08 |
| NFR-05-009 | Security | No secrets in SSE | Zero API keys, tokens, or PII in events | SECURITY-12 |
| NFR-05-010 | Reliability | SSE reconnect recovery | State recovered within 2s of reconnect | -- |
| NFR-05-011 | Reliability | Log buffer cap | 10,000 entries max per agent, circular buffer | -- |
| NFR-05-012 | Reliability | Malformed SSE handling | Silent drop, no crash, console warning | SECURITY-15 |
| NFR-05-013 | Reliability | Log preservation | No re-fetch on tab switch, scroll restored | -- |
| NFR-05-014 | Reliability | Typing degradation | Skip animation under frame pressure | -- |
| NFR-05-015 | Usability | Auto-scroll | 50px threshold, "Jump to latest" button | -- |
| NFR-05-016 | Usability | Tab switch speed | < 100ms content swap | -- |
| NFR-05-017 | Usability | Panel resize | Real-time drag, 36px-50vh clamp | -- |
| NFR-05-018 | Usability | Activity indicator | Pulsing dot when pipeline running | -- |
| NFR-05-019 | Usability | Responsive viz | Readable at 1280/768/375px | -- |
| NFR-05-020 | Usability | Keyboard a11y | Tab/Enter/Escape/Arrow navigation | -- |
| NFR-05-021 | Usability | Color contrast | WCAG 2.1 AA (4.5:1) | -- |
| NFR-05-022 | Maintainability | Component isolation | Props-only leaf components, no direct store | -- |
| NFR-05-023 | Maintainability | SSE type safety | Discriminated union, exhaustive switch | -- |
| NFR-05-024 | Maintainability | Animation constants | Centralized config, no magic numbers | -- |
