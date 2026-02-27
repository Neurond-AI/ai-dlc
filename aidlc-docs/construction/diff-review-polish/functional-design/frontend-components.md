# Frontend Components -- UOW-06: Diff Review & Polish

## Overview

This document defines all frontend components delivered in UOW-06. Each component includes its file path, props interface, internal state, user interactions, Framer Motion animations, API calls, and store usage. Components use shadcn/ui primitives, Tailwind v4, Framer Motion, Shiki (syntax highlighting), Lucide icons, and Zustand stores. UOW-06 also updates `TaskDetailView` (from UOW-03) and `SettingsPage` (from UOW-01) to integrate new functionality.

---

## Diff Review Components

### DiffReviewPanel

| Field | Value |
|-------|-------|
| **File** | `src/components/diff-review/diff-review-panel.tsx` |
| **Type** | Client Component (`"use client"`) |
| **Purpose** | Side panel for reviewing AI-generated file changes, containing file tree, diff viewer, and review actions |
| **Used In** | `src/components/task/task-detail-view.tsx` |

**Props Interface**:
```ts
interface DiffReviewPanelProps {
  taskId: string;
}
```

**Internal State**:
- Reads from `pipelineStore`: `pipelineRuns.get(taskId)` (fileChanges, reviewFindings, status)
- Reads from `taskStore`: task by ID (for status check, title for toast)
- Local state:
  ```ts
  {
    selectedFilePath: string | null;  // Currently selected file in tree
    fileTree: FileTreeNode[];          // Built from fileChanges
    diffs: UnifiedDiff[];              // Computed from fileChanges
    isOpen: boolean;                   // Sheet open state
  }
  ```

**Mount Logic**:
```ts
useEffect(() => {
  if (pipelineRun?.fileChanges) {
    const tree = DiffService.buildFileTree(pipelineRun.fileChanges);
    const computed = DiffService.computeDiffs(pipelineRun.fileChanges);
    setFileTree(tree);
    setDiffs(computed);
    // Auto-select first file
    const firstFile = findFirstFile(tree);
    if (firstFile) setSelectedFilePath(firstFile.path);
  }
}, [pipelineRun?.fileChanges]);
```

**Visibility Condition** (BR-06-001):
```ts
const isVisible = task?.status === "review" && pipelineRun?.fileChanges !== null;
```

**Layout** (shadcn/ui Sheet, side="right"):
```
+-------------------------------------------------------------------+
| [X] Code Review                              [file count] files    |
+----------+--------------------------------------------------------+
|          |                                                        |
| FileTree | DiffViewer                                             |
| (250px)  | (remaining width)                                     |
|          |                                                        |
| src/     | @@ -0,0 +1,25 @@                                     |
|  lib/    |    1 | import { pgTable } from 'drizzle-orm';          |
|   > db/  |    2 | export const users = pgTable('users', {         |
|    schema|    3 |   id: text('id').primaryKey(),                   |
|   > auth/|    4 |   name: text('name').notNull(),                  |
|  app/    |    5 |   email: text('email').notNull(),                |
|   > api/ |    6 | });                                              |
|          |                                                        |
+----------+--------------------------------------------------------+
| ReviewActions                                                      |
| [Approve]  [Request Changes]  [Retry]                Review: 85/100|
+-------------------------------------------------------------------+
```

**Framer Motion**:
```tsx
// Sheet content wrapper:
<motion.div
  initial={{ x: "100%" }}
  animate={{ x: 0 }}
  exit={{ x: "100%" }}
  transition={{ type: "spring", damping: 25, stiffness: 200 }}
>
```

**Sizing**:
- Width: `min(80vw, 1200px)` on desktop, `100vw` on mobile (< 768px)
- Height: 100vh (full screen height)

**API Calls**: None directly (delegated to ReviewActions child).

**Business Rules**: BR-06-001

---

### FileDiffCard

| Field | Value |
|-------|-------|
| **File** | `src/components/diff-review/file-diff-card.tsx` |
| **Type** | Client Component (`"use client"`) |
| **Purpose** | Summary card for a single changed file, showing file path, change type badge, line stats, and click-to-select behavior. Used as an alternative compact view when FileTree is collapsed on mobile. |

**Props Interface**:
```ts
interface FileDiffCardProps {
  filePath: string;
  language: string;
  action: "create" | "modify" | "delete";
  addedLines: number;
  removedLines: number;
  isSelected: boolean;
  onSelect: () => void;
}
```

**Rendering**:
```
FileDiffCard:
  |
  [1] Card container:
      - Border: border rounded-md px-3 py-2
      - Selected state: border-primary bg-primary/5
      - Hover: hover:bg-muted/50 cursor-pointer
  |
  [2] Row layout:
      [FileIcon] [filePath (truncated)] [ActionBadge] [+N / -N stats]
  |
  [3] File path: truncated with ellipsis, full path in tooltip
      - Display last 2 segments by default: "db/schema.ts"
      - Tooltip: full path "src/lib/db/schema.ts"
  |
  [4] Line stats:
      - Added: "+{addedLines}" in text-emerald-600
      - Removed: "-{removedLines}" in text-red-600
      - Separated by space, font-mono, text-xs
```

**Usage**: Rendered inside DiffReviewPanel as a mobile alternative to FileTree (visible when viewport < 768px, FileTree hidden). On desktop, FileTree is the primary navigation; FileDiffCard is not rendered.

---

### FileTree

| Field | Value |
|-------|-------|
| **File** | `src/components/diff-review/file-tree.tsx` |
| **Type** | Client Component (`"use client"`) |
| **Purpose** | Collapsible directory tree showing all changed files with action badges |

**Props Interface**:
```ts
interface FileTreeProps {
  tree: FileTreeNode[];
  selectedFilePath: string | null;
  onSelectFile: (filePath: string) => void;
}
```

**Internal State**:
```ts
{
  expandedPaths: Set<string>;  // Set of expanded directory paths
}
```

**Rendering Logic** (recursive):
```tsx
function FileTreeNodeComponent({ node, depth }: { node: FileTreeNode; depth: number }) {
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = node.path === selectedFilePath;

  if (node.type === "directory") {
    return (
      <div>
        <button
          onClick={() => toggleExpanded(node.path)}
          style={{ paddingLeft: `${depth * 16}px` }}
          className="flex items-center gap-1.5 w-full py-1 px-2 hover:bg-muted/50 rounded text-sm"
        >
          <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", isExpanded && "rotate-90")} />
          <Folder className="h-4 w-4 text-muted-foreground" />
          <span className="truncate">{node.name}</span>
        </button>
        {isExpanded && node.children?.map(child => (
          <FileTreeNodeComponent key={child.path} node={child} depth={depth + 1} />
        ))}
      </div>
    );
  }

  return (
    <button
      onClick={() => onSelectFile(node.path)}
      style={{ paddingLeft: `${depth * 16 + 20}px` }}
      className={cn(
        "flex items-center gap-1.5 w-full py-1 px-2 rounded text-sm",
        isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
      )}
    >
      <FileIcon language={node.language} className="h-4 w-4" />
      <span className="truncate flex-1">{node.name}</span>
      <ActionBadge action={node.action} />
    </button>
  );
}
```

**Action Badge Sub-Component**:

| Action | Text | CSS Classes |
|--------|------|-------------|
| create | A | `bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400` |
| modify | M | `bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400` |
| delete | D | `bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400` |

Badge size: `text-[10px] font-bold px-1.5 py-0.5 rounded`

**File Icon Logic**:
```ts
const FILE_ICONS: Record<string, LucideIcon> = {
  typescript: FileCode2,
  javascript: FileCode2,
  json: FileJson,
  css: FileText,
  html: FileCode,
  markdown: FileText,
  python: FileCode2,
  yaml: FileText,
};
// Default: FileText
```

**Framer Motion**:
- Directory expand/collapse: `AnimatePresence` on children, `initial={{ height: 0, opacity: 0 }}`, `animate={{ height: "auto", opacity: 1 }}`

**User Interactions**:

| Action | Handler | Result |
|--------|---------|--------|
| Click directory | `toggleExpanded(path)` | Add/remove path from expandedPaths Set |
| Click file | `onSelectFile(filePath)` | Parent sets selectedFilePath, DiffViewer updates |

**Business Rules**: BR-06-007 (sort order enforced by DiffService, not this component)

---

### DiffViewer

| Field | Value |
|-------|-------|
| **File** | `src/components/diff-review/diff-viewer.tsx` |
| **Type** | Client Component (`"use client"`) |
| **Purpose** | Side-by-side diff display with syntax highlighting, line numbers, and colored backgrounds |

**Props Interface**:
```ts
interface DiffViewerProps {
  diff: UnifiedDiff | null;
}
```

**Internal State**:
```ts
{
  highlightedHunks: HighlightedHunk[] | null;  // Shiki-highlighted content (async)
  isHighlighting: boolean;                       // Loading state for Shiki
}
```

**Rendering Logic**:
```tsx
// Single scroll container with CSS grid for alignment
<div className="overflow-auto font-mono text-sm">
  {diff === null ? (
    <EmptyDiffState />
  ) : (
    diff.hunks.map((hunk, i) => (
      <div key={i}>
        <HunkHeader hunk={hunk} />
        {hunk.lines.map((line, j) => (
          <DiffLineRow key={j} line={line} side="both" />
        ))}
      </div>
    ))
  )}
</div>
```

**DiffLineRow Sub-Component**:
```tsx
function DiffLineRow({ line }: { line: DiffLine }) {
  const bgClass = {
    added: "bg-emerald-50 dark:bg-emerald-950/20",
    removed: "bg-red-50 dark:bg-red-950/20",
    unchanged: "",
  }[line.type];

  const gutterClass = {
    added: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600",
    removed: "bg-red-100 dark:bg-red-900/30 text-red-600",
    unchanged: "text-muted-foreground",
  }[line.type];

  const prefix = { added: "+", removed: "-", unchanged: " " }[line.type];

  return (
    <div className={cn("grid grid-cols-[60px_60px_1fr] min-h-[20px]", bgClass)}>
      {/* Old line number */}
      <span className={cn("text-right pr-2 select-none text-xs leading-5", gutterClass)}>
        {line.type !== "added" ? line.lineNumber : ""}
      </span>
      {/* New line number */}
      <span className={cn("text-right pr-2 select-none text-xs leading-5", gutterClass)}>
        {line.type !== "removed" ? line.lineNumber : ""}
      </span>
      {/* Content */}
      <pre className="pl-2 leading-5 whitespace-pre-wrap break-all">
        <span className="select-none text-muted-foreground mr-1">{prefix}</span>
        <span dangerouslySetInnerHTML={{ __html: highlightedContent }} />
      </pre>
    </div>
  );
}
```

**Syntax Highlighting (Shiki)**:
```ts
// Lazy-load Shiki for performance
import { getHighlighter } from "shiki";

// Initialize once, cache highlighter instance
const highlighter = await getHighlighter({
  themes: ["github-dark", "github-light"],
  langs: ["typescript", "javascript", "json", "css", "html", "markdown", "python", "yaml"],
});

// Highlight individual lines:
const tokens = highlighter.codeToTokens(line.content, { lang: language, theme: currentTheme });
```

**Empty State**:
- No file selected: "Select a file from the tree to view changes"
- New file (create): left gutter shows "--" markers, content all green
- Deleted file: right gutter shows "--" markers, content all red

**HunkHeader**:
```tsx
<div className="bg-muted/30 px-4 py-1 text-xs text-muted-foreground font-mono border-y">
  @@ -{hunk.oldStart},{hunk.oldCount} +{hunk.newStart},{hunk.newCount} @@
</div>
```

**User Interactions**:

| Action | Handler | Result |
|--------|---------|--------|
| Scroll | Native scroll | Single scroll container for both sides |
| Select text | Native selection | Copy-pasteable code content |

**Accessibility**:
- `role="region"` with `aria-label="Diff viewer for {filePath}"`
- Line numbers are `aria-hidden="true"` (decorative)
- Added lines include `aria-label="Added line {lineNumber}: {content}"`
- Removed lines include `aria-label="Removed line {lineNumber}: {content}"`
- Color is not the only indicator: `+`/`-` prefix characters supplement green/red backgrounds
- Green/red diff backgrounds tested against WCAG AA on both light and dark themes (minimum 4.5:1 contrast ratio)
- `prefers-reduced-motion: reduce` disables syntax highlighting fade-in animations

**Business Rules**: BR-06-008 (language support), BR-06-009 (truncation handled by DiffService)

---

### DiffHunkView

| Field | Value |
|-------|-------|
| **File** | `src/components/diff-review/diff-hunk-view.tsx` |
| **Type** | Client Component (internal sub-component of DiffViewer) |
| **Purpose** | Render a single diff hunk with its header and all lines in the side-by-side layout |

**Props Interface**:
```ts
interface DiffHunkViewProps {
  hunk: DiffHunk;
  language: string;
  highlighter: Highlighter | null;
}
```

**Rendering**:
```
DiffHunkView:
  |
  [1] Render hunk header row (spans full width):
      "@@ -{oldStart},{oldCount} +{newStart},{newCount} @@"
      Style: bg-muted/30, text-muted-foreground, font-mono, text-xs, border-y, px-4, py-1
  |
  [2] For each line in hunk.lines:
      Render a DiffLineRow with 4 cells in the grid:
      [leftGutter] [leftContent] [rightGutter] [rightContent]
      |
      [a] type === "unchanged":
          leftGutter: original line number
          leftContent: syntax-highlighted content (via CodeBlock)
          rightGutter: new line number
          rightContent: syntax-highlighted content (same)
      |
      [b] type === "added":
          leftGutter: empty
          leftContent: empty spacer (bg-transparent)
          rightGutter: new line number
          rightContent: syntax-highlighted content (green bg, via CodeBlock)
      |
      [c] type === "removed":
          leftGutter: original line number
          leftContent: syntax-highlighted content (red bg, via CodeBlock)
          rightGutter: empty
          rightContent: empty spacer (bg-transparent)
  |
  [3] Truncation marker (lineNumber === -1):
      Full-width banner: "--- File truncated (>10,000 lines) ---"
      Style: bg-muted, text-muted-foreground, text-center, py-2, font-mono, text-sm, col-span-full
```

**Business Rules**: BR-06-009 (truncation marker)

---

### CodeBlock

| Field | Value |
|-------|-------|
| **File** | `src/components/diff-review/code-block.tsx` |
| **Type** | Client Component (internal sub-component of DiffHunkView) |
| **Purpose** | Render a single line of syntax-highlighted code with the appropriate diff background color |

**Props Interface**:
```ts
interface CodeBlockProps {
  content: string;
  language: string;
  lineType: DiffLineType;
  highlighter: Highlighter | null;
}
```

**Rendering**:
```
CodeBlock:
  |
  [1] If highlighter is available AND language is in SUPPORTED_LANGUAGES:
      - Call highlighter.codeToTokens(content, { lang, theme })
      - Render token <span> elements with Shiki-provided syntax colors
  |
  [2] If highlighter not available OR language not supported:
      - Render plain text in monospace font (no syntax colors)
  |
  [3] Apply diff background color based on lineType:
      - "added": bg-emerald-50 dark:bg-emerald-950/20
      - "removed": bg-red-50 dark:bg-red-950/20
      - "unchanged": bg-transparent
  |
  [4] Typography: font-mono, text-sm, whitespace-pre (preserve indentation)
  [5] Overflow: overflow-x-auto for long lines (horizontal scroll)
  [6] Min height: min-h-[20px] to maintain row alignment in side-by-side view
```

---

### ApproveButton, RejectButton, ApplyChangesButton

These are not standalone components but are rendered inline within **ReviewActions**. They are documented here for completeness:

| Logical Name | Rendered As | Variant | Icon | Purpose |
|-------------|-------------|---------|------|---------|
| ApproveButton | `<Button>` in ReviewActions | default (green accent: `bg-emerald-600 hover:bg-emerald-700 text-white`) | Check (Lucide) | Accept all AI changes, move task to Done |
| RejectButton (Request Changes) | `<Button>` in ReviewActions | outline (amber accent: `border-amber-300 text-amber-700 hover:bg-amber-50`) | MessageSquare (Lucide) | Open feedback form, restart from Coding phase |
| ApplyChangesButton (Retry) | `<Button>` in ReviewActions | ghost | RotateCcw (Lucide) | Discard changes, restart full pipeline from Planning |

**Button Behavior (all three)**:
- Disabled when any action is in-flight (`isApproving || isRequestingChanges || isRetrying`)
- Shows `<Loader2 className="animate-spin" />` replacing icon when that specific action is loading
- Text changes during loading: "Approving...", "Sending...", "Restarting..."
- On API error: toast.error() with error message, all buttons re-enabled

---

### ReviewActions

| Field | Value |
|-------|-------|
| **File** | `src/components/diff-review/review-actions.tsx` |
| **Type** | Client Component (`"use client"`) |
| **Purpose** | Action button bar at bottom of DiffReviewPanel: Approve, Request Changes, Retry |

**Props Interface**:
```ts
interface ReviewActionsProps {
  taskId: string;
  onClose: () => void;  // Close the DiffReviewPanel
}
```

**Internal State**:
- Uses `usePipeline(taskId)` hook for all actions and loading states
- Reads from `pipelineStore`: `reviewFindings?.score` (for display)
- Local state:
  ```ts
  {
    showRequestChangesForm: boolean;  // Toggle textarea visibility
    showRetryConfirm: boolean;        // Toggle confirmation dialog
  }
  ```

**Rendered Layout**:
```
+-------------------------------------------------------------------+
| Review Score: 85/100                                               |
|                                                                    |
| [showRequestChangesForm ? RequestChangesForm : null]               |
|                                                                    |
| [Approve (green)]  [Request Changes (amber)]  [Retry (gray)]      |
+-------------------------------------------------------------------+
```

**User Interactions**:

| Action | Handler | Result |
|--------|---------|--------|
| Click "Approve" | `usePipeline.approvePipeline()` | POST /api/pipeline/[taskId]/approve. On success: onClose(), SuccessAnimation, toast. |
| Click "Request Changes" | `setShowRequestChangesForm(true)` | Expand RequestChangesForm textarea below score |
| Click "Retry" | `setShowRetryConfirm(true)` | Show AlertDialog confirmation |
| Confirm Retry | `usePipeline.startPipeline()` | POST /api/pipeline/[taskId]/retry. On success: onClose(), toast. |
| Cancel Retry dialog | `setShowRetryConfirm(false)` | Close dialog, no action |

**Button States**:

| Button | Variant | Icon | Disabled When | Loading When |
|--------|---------|------|---------------|-------------|
| Approve | default (green accent) | Check | isApproving, isRequestingChanges, isRetrying | isApproving |
| Request Changes | outline (amber accent) | MessageSquare | isApproving, isRequestingChanges, isRetrying | isRequestingChanges |
| Retry | ghost (gray) | RotateCcw | isApproving, isRequestingChanges, isRetrying | isRetrying |

**Framer Motion**:
- Button bar: no special animation
- RequestChangesForm expand: `initial={{ height: 0, opacity: 0 }}` `animate={{ height: "auto", opacity: 1 }}`

**API Calls**:
```ts
// Approve:
POST /api/pipeline/${taskId}/approve
Headers: { Cookie: <session> }

// Request Changes (via RequestChangesForm submit):
POST /api/pipeline/${taskId}/request-changes
Body: { feedback: string }
Headers: { Cookie: <session>, "x-anthropic-key": <decryptedKey> }

// Retry:
POST /api/pipeline/${taskId}/retry
Headers: { Cookie: <session>, "x-anthropic-key": <decryptedKey> }
```

**Business Rules**: BR-06-002, BR-06-003, BR-06-004, BR-06-005, BR-06-006

---

### RequestChangesForm

| Field | Value |
|-------|-------|
| **File** | `src/components/diff-review/request-changes-form.tsx` |
| **Type** | Client Component (`"use client"`) |
| **Purpose** | Textarea for feedback when requesting changes, with character count and validation |

**Props Interface**:
```ts
interface RequestChangesFormProps {
  onSubmit: (feedback: string) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}
```

**Internal State**:
```ts
{
  feedback: string;    // Textarea value
  error: string | null; // Validation error
}
```

**Rendered Layout**:
```
+-------------------------------------------------------------------+
| Describe what needs to change:                                     |
| ┌───────────────────────────────────────────────────────────────┐ |
| │ The authentication middleware should also check for expired    │ |
| │ tokens and return a 401 instead of 500...                     │ |
| └───────────────────────────────────────────────────────────────┘ |
| [error message]                                    45/5000 chars   |
|                                                                    |
| [Cancel]  [Submit Feedback]                                        |
+-------------------------------------------------------------------+
```

**Validation**:
```ts
const isValid = feedback.trim().length >= 10;
// Submit button disabled until isValid
// Error shown on blur if feedback.trim().length > 0 && feedback.trim().length < 10
```

**User Interactions**:

| Action | Handler | Result |
|--------|---------|--------|
| Type in textarea | `onChange` -> update feedback | Clear error, update char count |
| Blur textarea | Validate min 10 chars | Show error if 1-9 chars |
| Click "Submit Feedback" | `onSubmit(feedback.trim())` | Delegate to parent |
| Click "Cancel" | `onCancel()` | Hide form |

**UI Elements**:
- `<Textarea>` (shadcn/ui) with placeholder "Describe what needs to change..."
- Character count: `${feedback.length}/5000` (muted text, right-aligned)
- Error text: red, below textarea (BR-06-003)
- Submit `<Button>` disabled when `!isValid || isSubmitting`

**Business Rules**: BR-06-003

---

### SuccessAnimation

| Field | Value |
|-------|-------|
| **File** | `src/components/diff-review/success-animation.tsx` |
| **Type** | Client Component (`"use client"`) |
| **Purpose** | Green checkmark overlay + glow effect when task is approved |

**Props Interface**:
```ts
interface SuccessAnimationProps {
  isVisible: boolean;
  onComplete: () => void;  // Called when animation finishes
}
```

**Internal State**: None (animation-driven).

**Rendering Logic**:
```tsx
<AnimatePresence>
  {isVisible && (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onAnimationComplete={onComplete}
    >
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", damping: 15, stiffness: 200 }}
      >
        <CheckCircle2 className="h-24 w-24 text-emerald-500" />
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
```

**Duration**: Full animation takes ~1.2s, then `onComplete` fires to reset state.

---

## Error Handling Components

### ErrorNotification (Updated from UOW-04)

| Field | Value |
|-------|-------|
| **File** | `src/components/pipeline/error-notification.tsx` |
| **Type** | Client Component (`"use client"`) |
| **Purpose** | Display pipeline error as toast + inline banner with retry/cancel actions and backoff countdown |
| **Status** | Defined in UOW-04 frontend-components; UOW-06 implements the full component |

**Props Interface**:
```ts
interface ErrorNotificationProps {
  taskId: string;
}
```

**Internal State**:
- Reads from `pipelineStore`: `pipelineRuns.get(taskId).errorDetails`
- Uses `usePipeline(taskId)` hook for retry/cancel actions
- Local state:
  ```ts
  {
    isDismissed: boolean;          // User dismissed the inline banner
    retryCountdown: number | null; // Countdown seconds (from SSE agent-log "Retrying in Xs...")
  }
  ```

**Trigger Condition**:
- Renders inline banner when `pipelineRun.status === "paused"` AND `errorDetails !== null` AND `!isDismissed`
- Fires Sonner toast on error event arrival (once per error, tracked by errorDetails.timestamp)

**Toast (Sonner)**:
```ts
useEffect(() => {
  if (errorDetails && !toastFiredRef.current) {
    toast.error("Pipeline Error", {
      description: errorDetails.message,
      duration: 10000,  // BR-06-010
      action: {
        label: "Retry",
        onClick: () => usePipeline.retryPipeline(),
      },
    });
    toastFiredRef.current = errorDetails.timestamp;
  }
}, [errorDetails]);
```

**Inline Banner Layout**:
```
+--------------------------------------------------------------+
| [AlertTriangle] Pipeline Error                        [X]     |
|                                                               |
| Anthropic API error: 429 Rate Limited                         |
| Agent: Coder | Phase: Coding | Retry 1/3                     |
| [Retrying in 2s...]  <- shown during backoff countdown        |
|                                                               |
| [Retry]  [Cancel Pipeline]                                    |
+--------------------------------------------------------------+
```

**Countdown Logic**:
```ts
// Listen for SSE agent-log events containing "Retrying in"
useEffect(() => {
  const logs = agentLogs?.[errorDetails?.failedAgent ?? "planner"] ?? [];
  const lastLog = logs[logs.length - 1];
  if (lastLog?.chunk.startsWith("Retrying in")) {
    const seconds = parseInt(lastLog.chunk.match(/\d+/)?.[0] ?? "0");
    setRetryCountdown(seconds);
    // Countdown timer
    const interval = setInterval(() => {
      setRetryCountdown(prev => (prev && prev > 0) ? prev - 1 : null);
    }, 1000);
    return () => clearInterval(interval);
  }
}, [agentLogs]);
```

**User Interactions**:

| Action | Handler | Result |
|--------|---------|--------|
| Click "Retry" | `usePipeline.retryPipeline()` | POST retry, dismiss banner |
| Click "Cancel Pipeline" | `usePipeline.cancelPipeline()` | POST cancel, dismiss banner |
| Click "X" | `setIsDismissed(true)` | Hide inline banner (toast already dismissed or auto-dismissed) |

**UI Elements**:
- `<Alert>` (shadcn/ui) variant="destructive" for inline banner
- AlertTriangle icon (Lucide)
- Text styling: error message in semibold, metadata (agent, phase, retry count) in muted

**Business Rules**: BR-06-010, BR-04-017 (backoff timing display)

---

## Settings Components

### SettingsPage (Updated from UOW-01)

| Field | Value |
|-------|-------|
| **Route** | `/settings` (route group: `(dashboard)`) |
| **File** | `src/app/(dashboard)/settings/page.tsx` |
| **Type** | Page (Client Component) |
| **Purpose** | User settings with tabbed layout; API Key + Profile tabs |
| **Status** | Stub in UOW-01; UOW-06 adds fully functional Profile tab |

**Internal State**:
- `activeTab: "api-key" | "profile"` (default: "api-key")
- Reads from `authStore`: `user`

**Layout** (shadcn/ui Tabs):
```
Settings
+----------+----------+
| API Key  | Profile  |
+----------+----------+
|                     |
| (Active tab content)|
|                     |
+---------------------+
```

**Tab Content**:

| Tab | Component | Status |
|-----|-----------|--------|
| API Key | `<ApiKeyForm />` (from UOW-01) | Fully functional (no changes) |
| Profile | `<ProfileForm />` (new in UOW-06) | New |

**Business Rules**: BR-06-011

---

### ProfileForm

| Field | Value |
|-------|-------|
| **File** | `src/components/settings/profile-form.tsx` |
| **Type** | Client Component (`"use client"`) |
| **Purpose** | Edit display name, view email (read-only) |

**Props Interface**:
```ts
// No external props. Reads from authStore.
```

**Internal State**:
```ts
{
  name: string;          // Input value, initialized from authStore.user.name
  errors: {
    name?: string;       // Validation error
    form?: string;       // Server error
  };
  isSaving: boolean;     // Loading state
  isDirty: boolean;      // True if name differs from original
}
```

**Rendered Layout**:
```
+-------------------------------------------+
| Display Name                               |
| ┌───────────────────────────────────────┐ |
| │ Alex Johnson                          │ |
| └───────────────────────────────────────┘ |
| [error message]                            |
|                                            |
| Email                                      |
| ┌───────────────────────────────────────┐ |
| │ alex@example.com              [lock]  │ |  <- disabled, read-only
| └───────────────────────────────────────┘ |
| Your email cannot be changed.              |
|                                            |
| [Save Changes]                             |  <- disabled when !isDirty or isSaving
+-------------------------------------------+
```

**User Interactions**:

| Action | Handler | Result |
|--------|---------|--------|
| Edit name | `onChange` -> update name, set isDirty | Clear error |
| Click "Save Changes" | Validate -> PATCH /api/auth/me | Update name |
| Clear name field | Show inline error on blur | "Name cannot be empty" |

**Validation (Zod)**:
```ts
// Uses updateProfileSchema from lib/validations/profile-schemas.ts
const updateProfileSchema = z.object({
  name: z.string().min(1, "Name cannot be empty").max(100, "Name must be 100 characters or fewer").trim(),
});
```

**API Calls**:
```ts
// On save:
PATCH /api/auth/me
Body: { name: trimmedName }
Headers: { Cookie: <session> }

// On success:
authStore.setUser({ ...user, name: trimmedName });
toast.success("Profile updated");

// On error:
setErrors({ form: "Failed to update profile. Please try again." });
```

**Business Rules**: BR-06-012

---

## Updated Components (From Previous UOWs)

### TaskDetailView (Updated from UOW-03)

| Field | Value |
|-------|-------|
| **File** | `src/components/task/task-detail-view.tsx` |
| **Status** | Existing from UOW-03; UOW-06 replaces diff placeholder with DiffReviewPanel |

**Changes in UOW-06**:

1. **Replace diff placeholder slot** with conditional DiffReviewPanel render:
```tsx
// Before (UOW-03):
<div className="border rounded-lg p-4 text-muted-foreground">
  Code diff will appear here after pipeline completion.
</div>

// After (UOW-06):
{task.status === "review" && pipelineRun?.fileChanges && (
  <DiffReviewPanel taskId={task.id} />
)}
```

2. **Add ErrorNotification** for pipeline errors:
```tsx
{pipelineRun?.status === "paused" && pipelineRun.errorDetails && (
  <ErrorNotification taskId={task.id} />
)}
```

3. **Add SuccessAnimation** trigger on approve:
```tsx
<SuccessAnimation
  isVisible={showSuccessAnimation}
  onComplete={() => setShowSuccessAnimation(false)}
/>
```

4. **Add failed state display** when task has failed pipeline:
```tsx
{task.status === "backlog" && pipelineRun?.status === "failed" && (
  <FailedPipelineBanner taskId={task.id} />
)}
```

---

## Component Dependency Tree (UOW-06 Scope)

```
TaskDetailView (UOW-03, updated)
  |
  ├── DiffReviewPanel                    [pipelineStore, taskStore]
  |     |
  |     ├── FileTree                     [local state: expandedPaths]
  |     |     └── FileTreeNodeComponent (recursive)
  |     |           ├── ActionBadge
  |     |           └── FileIcon
  |     |
  |     ├── DiffViewer                   [Shiki highlighter]
  |     |     ├── HunkHeader
  |     |     └── DiffLineRow (per line)
  |     |
  |     └── ReviewActions                [usePipeline hook]
  |           ├── RequestChangesForm     [local state: feedback]
  |           └── AlertDialog (Retry confirmation)
  |
  ├── ErrorNotification                  [pipelineStore, usePipeline]
  |
  └── SuccessAnimation                   [Framer Motion]

SettingsPage (UOW-01, updated)
  |
  ├── ApiKeyForm (UOW-01, unchanged)     [localStorage]
  |
  └── ProfileForm (new)                  [authStore]
```

---

## Zustand Store Usage by Component

| Component | pipelineStore | taskStore | authStore | uiStore | Notes |
|-----------|--------------|-----------|-----------|---------|-------|
| DiffReviewPanel | read (fileChanges, reviewFindings) | read (task by ID) | - | - | Core panel |
| FileTree | - | - | - | - | Pure display, props-driven |
| DiffViewer | - | - | - | - | Pure display, props-driven |
| ReviewActions | read (score) | read (task title) | - | write (setActiveLogTab on RC) | Action buttons |
| RequestChangesForm | - | - | - | - | Pure form, props-driven |
| SuccessAnimation | - | - | - | - | Pure animation |
| ErrorNotification | read (errorDetails, agentLogs) | - | - | - | Error UX |
| SettingsPage | - | - | read (user) | - | Tab layout |
| ProfileForm | - | - | read/write (user) | - | Name editing |

---

## Zustand pipelineStore Updates (UOW-06 Additions)

The following actions are added or updated in `pipelineStore` (defined in UOW-04):

| Action | Change | Trigger |
|--------|--------|---------|
| `approvePipeline(taskId)` | New action. POST to approve endpoint, update local status to "passed" optimistically. | ReviewActions "Approve" button |
| `requestChanges(taskId, feedback)` | New action. POST to request-changes endpoint, clear fileChanges/reviewFindings locally. | RequestChangesForm submit |

```ts
// New actions added to pipelineStore:

approvePipeline: async (taskId: string) => {
  // POST /api/pipeline/${taskId}/approve
  // On success: server pushes SSE task-status { newStatus: "done" }
  // Store update happens via SSE, not optimistically
},

requestChanges: async (taskId: string, feedback: string) => {
  const apiKey = getDecryptedApiKey();
  // POST /api/pipeline/${taskId}/request-changes
  // Body: { feedback }
  // Headers: { "x-anthropic-key": apiKey }
  // On success: server pushes SSE events, store updates via SSE
},
```

---

## shadcn/ui Components Required (UOW-06)

| Component | Used By | Purpose |
|-----------|---------|---------|
| Sheet | DiffReviewPanel | Side panel from right |
| Button | ReviewActions, RequestChangesForm, ProfileForm, ErrorNotification | Actions |
| Textarea | RequestChangesForm | Feedback input |
| Tabs | SettingsPage | API Key / Profile tab layout |
| Input | ProfileForm | Name input |
| Label | ProfileForm | Field labels |
| Alert | ErrorNotification | Error banner |
| AlertDialog | ReviewActions (Retry confirmation) | Destructive action confirmation |
| Tooltip | FileTree (truncated file names) | Full path on hover |
| Sonner (toast) | ErrorNotification, ReviewActions, ProfileForm | Notifications |
| Badge | FileTree (action badges), ReviewActions (score) | Status display |
| ScrollArea | FileTree, DiffViewer | Scrollable content |
| Separator | DiffReviewPanel (between tree and viewer) | Visual divider |

---

## Accessibility Considerations

### Diff Review Panel Accessibility

| Concern | Implementation |
|---------|---------------|
| Focus management | Focus trapped inside DiffReviewPanel when open (Sheet handles this). On close, focus returns to the trigger element in TaskDetailView. |
| Keyboard navigation | Escape closes panel. Tab moves between FileTree, DiffViewer, and ReviewActions. |
| Screen reader announcements | Panel open/close announced via `aria-live="polite"` region. File count ("3 files changed") announced on panel open. |
| Motion preferences | `prefers-reduced-motion: reduce` disables slide-in/out animations, uses instant transitions. |

### FileTree Accessibility

| Concern | Implementation |
|---------|---------------|
| Tree pattern | `role="tree"` on root container, `role="treeitem"` on each node. |
| Expand/collapse | `aria-expanded` on directory nodes. Screen readers announce "expanded"/"collapsed". |
| Selection | `aria-selected="true"` on currently selected file. |
| Keyboard | ArrowUp/ArrowDown to navigate between visible nodes. Enter to select file or toggle directory. ArrowRight to expand directory. ArrowLeft to collapse directory or move to parent. |
| Focus indicator | `focus-visible:ring-2 ring-ring` on all interactive tree items. |

### DiffViewer Accessibility

| Concern | Implementation |
|---------|---------------|
| Color independence | Added/removed lines use both color AND text prefix (+/-). Badge text ("Added"/"Modified"/"Deleted") supplements color coding in FileTree. |
| Contrast | Green/red backgrounds pass WCAG AA contrast (4.5:1) for text in both light and dark modes. |
| Screen readers | Each diff line has `aria-label` with change type prefix: "Added line 5: {content}" / "Removed line 3: {content}". Line numbers are `aria-hidden="true"`. |
| Region labeling | `role="region"` with `aria-label="Diff viewer for {filePath}"` on the diff container. |

### ReviewActions Accessibility

| Concern | Implementation |
|---------|---------------|
| Loading states | Buttons use `aria-busy="true"` when loading. Spinner has `aria-label="Loading"`. |
| Disabled states | Disabled buttons include `aria-disabled="true"` and `title` attribute explaining why. |
| Confirmation dialog | AlertDialog (shadcn/ui) provides built-in ARIA dialog role, focus trap, and Escape to close. |
| Form validation | RequestChangesForm character count uses `aria-live="polite"` for real-time updates. Validation errors use `role="alert"`. |

### Settings Page Accessibility

| Concern | Implementation |
|---------|---------------|
| Form labels | All inputs have associated `<Label>` elements via `htmlFor`. |
| Error announcements | Inline errors use `aria-live="polite"` and `role="alert"` for screen reader announcement. |
| Disabled email field | `aria-disabled="true"` with visible helper text "Your email cannot be changed." |
| Tab navigation | shadcn/ui Tabs component provides ARIA `tablist`, `tab`, `tabpanel` roles automatically. |
| Success feedback | Toast notifications (Sonner) use `role="status"` for non-intrusive screen reader announcement. |

### Global Accessibility

| Concern | Implementation |
|---------|---------------|
| Reduced motion | All Framer Motion animations check `useReducedMotion()` hook and use instant transitions when preferred. |
| Color scheme | All components support light and dark modes via Tailwind `dark:` variants. |
| Text scaling | All text uses `rem`/`em` units. Layout does not break at 200% browser zoom. |
| Keyboard shortcuts | Escape universally closes modals/panels. No single-key shortcuts that could conflict with assistive technology. |

---

## Third-Party Library Integration

### Shiki (Syntax Highlighting)

| Package | Usage |
|---------|-------|
| `shiki` | `getHighlighter()`, `codeToTokens()` |

**Configuration**:
```ts
// Lazy-loaded singleton
let highlighterPromise: Promise<Highlighter> | null = null;

export function getShikiHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = getHighlighter({
      themes: ["github-dark", "github-light"],
      langs: ["typescript", "javascript", "json", "css", "html", "markdown", "python", "yaml"],
    });
  }
  return highlighterPromise;
}
```

**Bundle Impact**: Shiki is tree-shakeable. Loading only 8 languages + 2 themes keeps the bundle addition under 200KB (gzipped). Languages loaded on demand via dynamic import.

### diff (Line Diffing)

| Package | Usage |
|---------|-------|
| `diff` | `diffLines()` for computing line-level diffs in DiffService |

**Usage in DiffService**:
```ts
import { diffLines } from "diff";

// For "modify" action:
const changes = diffLines(originalContent, newContent);
// Convert to DiffHunk[] with context lines
```

### Framer Motion

| Component | Animation |
|-----------|-----------|
| DiffReviewPanel (Sheet) | Slide in/out from right (x: 100% -> 0) |
| FileTree (directory expand) | Height + opacity transition |
| ReviewActions (RequestChangesForm) | Height + opacity expand |
| SuccessAnimation | Scale + rotate checkmark, opacity overlay |
| ErrorNotification (inline banner) | Fade in/out |

### Lucide Icons

| Icon | Used In | Purpose |
|------|---------|---------|
| Check | ReviewActions (Approve) | Approve button icon |
| MessageSquare | ReviewActions (Request Changes) | Request Changes button icon |
| RotateCcw | ReviewActions (Retry) | Retry button icon |
| ChevronRight | FileTree | Directory expand indicator |
| Folder | FileTree | Directory icon |
| FileCode2 | FileTree | TypeScript/JS/Python file icon |
| FileJson | FileTree | JSON file icon |
| FileText | FileTree | CSS/HTML/Markdown/YAML file icon |
| FileCode | FileTree | HTML file icon |
| AlertTriangle | ErrorNotification | Error indicator |
| X | DiffReviewPanel, ErrorNotification | Close button |
| CheckCircle2 | SuccessAnimation | Success checkmark |
| Lock | ProfileForm | Email field lock icon |
| Settings | Sidebar (existing) | Settings nav icon |
