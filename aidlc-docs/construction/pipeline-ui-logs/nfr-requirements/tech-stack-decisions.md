# Tech Stack Decisions -- UOW-05: Pipeline UI & Agent Logs

## Overview

Technology decisions specific to UOW-05. UOW-01 tech stack (Next.js 15, React 19, Tailwind CSS 4, shadcn/ui, Framer Motion, Zustand) remains the foundation. UOW-05 introduces no new npm dependencies -- all functionality is built using the existing stack. This document covers the specific usage patterns and architectural decisions for real-time UI rendering.

---

## No New Dependencies

| Existing Technology | UOW-05 Usage | Rationale for Reuse |
|--------------------|-------------|---------------------|
| Framer Motion | Pipeline node pulse, connector fill, panel expand/collapse, tab transitions | Already in UOW-01 stack. Declarative API ideal for state-driven animations. Layout animations handle tab content swaps. |
| shadcn/ui Tabs | Agent log panel tab switching (Planner/Coder/Reviewer) | Accessible tab component built on Radix Tabs primitive. Keyboard navigation included. |
| Zustand | pipelineStore (SSE event consumption), uiStore (panel state) | Already manages client state. SSE events dispatch directly to store actions. Selector-based re-renders minimize unnecessary UI updates. |
| Tailwind CSS 4 | Pipeline node styling, log entry color-coding, responsive layout | Utility classes for phase-specific colors (amber/blue/purple). CSS custom properties for animation values. |
| Lucide React | Pipeline node icons, agent tab icons, status indicators | Tree-shakeable icons: CheckCircle2, XCircle, Lightbulb, Code2, MessageSquare, ChevronDown. |
| React 19 | useCallback/useMemo for animation optimization, refs for scroll containers | Concurrent features ensure animations remain smooth during SSE event processing. |

**Decision**: No new packages added. Keeps bundle size stable and avoids dependency sprawl for a UI-only unit.

---

## Decision Rationale -- Key Choices

### Framer Motion for Pipeline Animations (over CSS-only)

**Decision**: Framer Motion for all pipeline and panel animations.

**Rationale**:
- Declarative `animate` prop maps directly to pipeline state changes -- no manual class toggling
- `layout` prop enables automatic tab content transitions without FLIP calculations
- Spring physics for panel expand/collapse feels more natural than CSS `transition`
- `AnimatePresence` handles exit animations (e.g., error banner dismissal)
- `useMotionValue` and `useTransform` for drag-based panel resize without re-renders
- Already in the dependency tree (UOW-01) -- zero additional bundle cost

**Alternatives considered**:

| Alternative | Why rejected |
|-------------|-------------|
| CSS Animations only | No declarative state binding. Pulse animation possible, but connector fill and panel spring require JS. Complex keyframe management for multi-state nodes. |
| React Spring | Additional dependency. Framer Motion already covers all use cases. Different API paradigm would fragment animation approach. |
| GSAP | Large bundle size (~35KB min). Imperative API conflicts with React declarative model. License restrictions for some features. |
| Lottie | Designed for pre-built animations (After Effects export). Not suitable for state-driven, real-time UI animations. |

### Virtual Scrolling Decision (Deferred)

**Decision**: Standard DOM rendering with buffer cap (10,000 entries) instead of virtual scrolling for MVP.

**Rationale**:
- Log entries are small, fixed-height elements (single line of text)
- 5,000 entries at ~40px height = ~200,000px scroll height -- within browser limits
- Circular buffer cap (10,000 entries per agent) bounds DOM node count
- React 19 concurrent rendering handles batch updates efficiently
- Virtual scrolling adds complexity (scroll position management, dynamic height estimation)
- If performance issues arise post-MVP, `@tanstack/virtual` can be added as a drop-in

**Scaling path**: If log entry count grows beyond 10,000 or entries become multi-line:
1. Add `@tanstack/react-virtual` for virtualized list rendering
2. Log entries stored in flat array (already compatible with virtualizer API)
3. Auto-scroll logic adapts to virtual scroll container

**CSS fallback**: `content-visibility: auto` on log entries for native browser optimization (Chrome/Edge):
```css
.log-entry {
  content-visibility: auto;
  contain-intrinsic-size: 0 24px;
}
```

**Alternatives considered**:

| Alternative | Why rejected |
|-------------|-------------|
| @tanstack/react-virtual | Adds dependency and complexity. Buffer cap makes it unnecessary for MVP. Deferred to post-MVP if perf issues arise. |
| react-window | Older library, less maintained than @tanstack/virtual. Fixed-size-only mode -- log entries may vary in height. |
| Infinite scroll with pagination | Logs are append-only streams, not paginated data. Would complicate auto-scroll behavior. |

### SSE EventSource (over WebSocket)

**Decision**: Native `EventSource` API for SSE consumption.

**Rationale**:
- SSE is unidirectional (server -> client) -- matches pipeline streaming use case exactly
- `EventSource` is a browser built-in -- zero dependency
- Automatic reconnection built into the `EventSource` API (supplemented by custom retry logic in NFR-04-011)
- Cookies sent automatically on same-origin connections (no auth header workaround needed)
- Server implementation simpler than WebSocket (standard HTTP response with streaming body)
- UOW-04 server already implements SSE endpoint

**Alternatives considered**:

| Alternative | Why rejected |
|-------------|-------------|
| WebSocket | Bidirectional overkill for read-only streaming. Requires upgrade handshake, separate connection management, manual reconnect logic. Cookie auth not automatic. |
| WebSocket + Socket.IO | Additional dependency (~50KB). Polling fallback unnecessary (SSE has browser support). Room-based broadcasting overkill for single-user pipeline view. |
| Polling (short/long) | Higher latency (minimum poll interval vs instant push). More server load. Poor UX for real-time streaming text. |
| Fetch streaming (ReadableStream) | No built-in reconnection. Manual event parsing. Less ergonomic than EventSource API. |

### CSS Approach for Pipeline Visualization

**Decision**: Tailwind utility classes with CSS custom properties for phase colors.

**Rationale**:
- Phase colors defined as CSS custom properties (design tokens): `--phase-spec`, `--phase-plan`, `--phase-code`, `--phase-review`, `--phase-done`
- Tailwind `bg-[var(--phase-spec)]` syntax for dynamic color application
- Connector track uses Tailwind `bg-muted` with animated fill overlay
- Node sizing uses fixed dimensions (48px circle) for consistent layout across breakpoints
- Horizontal layout with `flex` and `gap` -- no need for CSS Grid or absolute positioning

**Phase Color Tokens**:

| Phase | CSS Custom Property | Light Mode | Dark Mode |
|-------|-------------------|------------|-----------|
| Spec | `--phase-spec` | amber-500 | amber-400 |
| Plan | `--phase-plan` | orange-500 | orange-400 |
| Code | `--phase-code` | blue-500 | blue-400 |
| Review | `--phase-review` | purple-500 | purple-400 |
| Done | `--phase-done` | emerald-500 | emerald-400 |
| Failed | `--phase-failed` | red-500 | red-400 |

**Color Contrast Compliance** (WCAG 2.1 AA):
- Amber-500 on white: 3.0:1 (fails AA for text) -- use amber-600 (`#D97706`, 4.6:1) for text labels
- All other phase colors pass AA (4.5:1+) on white background
- All phase colors pass AA on dark mode backgrounds
- Status conveyed by icon + color (not color-only) for colorblind accessibility

**Alternatives considered**:

| Alternative | Why rejected |
|-------------|-------------|
| SVG-based pipeline | Overkill for 5-node horizontal flow. SVG adds accessibility complexity. Framer Motion works better with DOM elements. |
| Canvas rendering | Not accessible. Cannot use React component model. Overkill for static node layout with simple animations. |
| CSS Grid layout | Flex layout is simpler for single-row horizontal node arrangement. Grid unnecessary for 1D layout. |

### Typing Effect Implementation

**Decision**: Custom `useTypingEffect` hook using `requestAnimationFrame`.

**Rationale**:
- `requestAnimationFrame` syncs with browser paint cycle -- no frame drops
- Character reveal rate (~30 chars per append, 50ms intervals) provides readable streaming feel
- Hook manages its own state -- no external animation library needed
- Blinking cursor effect via CSS animation (`opacity` keyframe) -- minimal cost
- Cleanup via `cancelAnimationFrame` on unmount prevents memory leaks
- Graceful degradation: if frame time exceeds 32ms, switch to bulk append (NFR-05-014)

**Implementation pattern**:
```typescript
function useTypingEffect(fullText: string, speed: number = 50) {
  const [displayed, setDisplayed] = useState("");
  const rafRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const indexRef = useRef(0);

  useEffect(() => {
    indexRef.current = 0;
    setDisplayed("");

    const animate = (timestamp: number) => {
      const frameDelta = timestamp - lastTimeRef.current;

      if (timestamp - lastTimeRef.current >= speed) {
        lastTimeRef.current = timestamp;

        // Graceful degradation: bulk append if frames are dropping
        const charsPerAppend = frameDelta > 32 ? 50 : 30;
        const nextIndex = Math.min(indexRef.current + charsPerAppend, fullText.length);
        setDisplayed(fullText.slice(0, nextIndex));
        indexRef.current = nextIndex;
      }

      if (indexRef.current < fullText.length) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [fullText, speed]);

  return { displayed, isTyping: displayed.length < fullText.length };
}
```

**Alternatives considered**:

| Alternative | Why rejected |
|-------------|-------------|
| setInterval-based | Not synced with paint cycle. Can cause frame drops if interval misaligns with rAF. |
| Framer Motion text animation | No built-in character-by-character reveal. Would require custom variant per character -- expensive for long strings. |
| CSS `@keyframes` with `ch` unit | Cannot dynamically set width for streaming text. Only works for fixed-length strings. |
| Typewriter library (e.g., typed.js) | Additional dependency. Not React-native. Difficult to integrate with Zustand store updates. |

---

## Framer Motion Animation Patterns

### Pipeline Node Transitions

```typescript
// Spring physics for node state transitions
const nodeVariants = {
  pending: {
    scale: 1,
    opacity: 0.5,
    transition: { type: "spring", stiffness: 300, damping: 25 },
  },
  active: {
    scale: [1, 1.05, 1],
    opacity: 1,
    boxShadow: [
      "0 0 0 0 rgba(var(--phase-color), 0)",
      "0 0 0 8px rgba(var(--phase-color), 0.15)",
      "0 0 0 0 rgba(var(--phase-color), 0)",
    ],
    transition: { duration: 2, repeat: Infinity, ease: "easeInOut" },
  },
  completed: {
    scale: 1,
    opacity: 1,
    transition: { type: "spring", stiffness: 300, damping: 25 },
  },
  failed: {
    scale: 1,
    opacity: 1,
    transition: { duration: 0.3 },
  },
};
```

### Connector Fill Animation

```typescript
// Gradient bar fill from left to right
<motion.div
  className="h-0.5 bg-current"
  initial={{ width: "0%" }}
  animate={{ width: "100%" }}
  transition={{ duration: 0.8, ease: "easeOut" }}
/>
```

### Panel Expand/Collapse

```typescript
// Spring-based height animation for BottomDock
<motion.div
  animate={{ height: isExpanded ? panelHeight : 36 }}
  transition={{ type: "spring", stiffness: 400, damping: 30 }}
/>
```

### Performance Considerations

- Use `transform` and `opacity` only for animations (GPU-composited, no layout thrashing)
- Avoid animating `width`, `height`, `top`, `left` on frequently-updating elements
- Use `layout` prop sparingly -- only on elements that change position
- Set `layoutId` for shared layout animations between pipeline states
- Use `AnimatePresence` for exit animations on phase completion

---

## Responsive Layout Decisions

### Pipeline Visualization

| Breakpoint | Layout | Node Size | Connector Width | Labels |
|-----------|--------|-----------|-----------------|--------|
| Desktop (>= 1280px) | Horizontal row | 48px circle | 48px | Full text + timing below |
| Tablet (>= 768px) | Horizontal row (condensed) | 40px circle | 32px | Abbreviated text below |
| Mobile (>= 375px) | Horizontal row (icons only) | 32px circle | 24px | Icon only (no text) |

### Agent Log Panel (BottomDock)

| Breakpoint | Default Height | Max Height | Tab Style |
|-----------|---------------|------------|-----------|
| Desktop (>= 1280px) | 300px | 50vh | Full: icon + label + unread dot |
| Tablet (>= 768px) | 250px | 50vh | Compact: icon + label |
| Mobile (>= 375px) | 200px | 60vh | Icon only |

---

## Auto-Scroll Implementation

```typescript
function useAutoScroll(containerRef: RefObject<HTMLElement>) {
  const isUserScrolledUp = useRef(false);
  const BOTTOM_THRESHOLD = 50; // px from bottom

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      isUserScrolledUp.current = distanceFromBottom > BOTTOM_THRESHOLD;
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (isUserScrolledUp.current) return;
    containerRef.current?.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, []);

  return { scrollToBottom, isUserScrolledUp };
}
```

**Key Design Decisions**:
- **Passive scroll listener**: `{ passive: true }` prevents scroll jank
- **Bottom threshold (50px)**: Buffer prevents auto-scroll disengage from minor content growth
- **`scrollTo` over `scrollIntoView`**: More predictable, avoids scrolling parent containers
- **`behavior: "smooth"`**: Native smooth scrolling, no JS animation overhead

---

## Compatibility

| Pattern | Requires | Compatible With |
|---------|----------|-----------------|
| EventSource SSE | Modern browser (all current) | Same-origin cookies, HTTP/2 |
| Framer Motion layout | React 19 | shadcn/ui Tabs, Radix primitives |
| requestAnimationFrame | All browsers | React concurrent rendering |
| CSS custom properties | Modern browsers | Tailwind CSS 4, dark mode |
| Zustand selectors | Zustand 5 | React 19 useSyncExternalStore |
| content-visibility: auto | Chrome/Edge 85+ | Graceful degradation (no-op in unsupported browsers) |
