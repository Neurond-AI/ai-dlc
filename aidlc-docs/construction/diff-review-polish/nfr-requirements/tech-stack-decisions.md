# Tech Stack Decisions -- UOW-06: Diff Review & Polish

## Overview

Technology decisions specific to UOW-06. UOW-01 tech stack (Next.js 15, React 19, Tailwind CSS 4, shadcn/ui, Framer Motion, Zustand, Zod) remains the foundation. This document covers two new dependencies (Shiki for syntax highlighting, diff for line-level comparison) and architectural decisions for diff rendering, code display, and review workflows.

---

## New Dependencies

| Technology | Version | Purpose | Rationale |
|-----------|---------|---------|-----------|
| shiki | latest (pinned at install) | Syntax highlighting for code display in DiffViewer | Lightweight, tree-shakeable, supports all target languages. TextMate grammar-based (same as VS Code). Async API prevents main thread blocking. No runtime CSS-in-JS. |
| diff | latest (pinned at install) | Line-level diff computation for "modify" actions | Mature (10+ years), minimal API, implements Myers diff algorithm. Produces structured output compatible with unified diff format. ~5KB minified. |

---

## Decision Rationale -- Key Choices

### Shiki over alternatives (Syntax Highlighting)

**Decision**: Shiki for all code syntax highlighting in DiffViewer.

**Rationale**:
- TextMate grammar-based -- same highlighting quality as VS Code
- Tree-shakeable: load only needed language grammars (TypeScript, JavaScript, JSON, CSS, HTML, Markdown, Python, YAML)
- Async API: `highlighter.codeToHtml()` can run without blocking the main thread
- Produces self-contained HTML with inline styles -- no external CSS themes required
- Entity-encodes all input tokens (built-in XSS safety for code display)
- Theme support: built-in dark/light themes matching app's color scheme
- Single highlighter instance reusable across all file renders

**Alternatives considered**:

| Alternative | Why rejected |
|-------------|-------------|
| Prism.js | Requires runtime CSS class injection. Plugins system adds complexity. Less accurate highlighting than TextMate grammars. |
| highlight.js | Larger bundle (~200KB for all languages). Auto-detection unreliable. Less accurate than TextMate. Runtime DOM manipulation approach. |
| CodeMirror | Full editor, not a highlighter. Massive bundle (~150KB+). Overkill for read-only code display. |
| Monaco Editor | VS Code's full editor engine. ~2MB bundle. Completely overkill for read-only diff viewing. |
| React Syntax Highlighter | Wrapper around Prism or highlight.js. Adds React component overhead. Does not add highlighting quality. |
| No highlighting (plain text) | Poor code readability in review workflow. Users expect syntax-aware display for code review. |

### Shiki Integration Pattern

```typescript
// lib/services/syntax-highlighter.ts
import { getHighlighter, type Highlighter } from "shiki";

let highlighterInstance: Highlighter | null = null;

export async function getShikiHighlighter(): Promise<Highlighter> {
  if (!highlighterInstance) {
    highlighterInstance = await getHighlighter({
      themes: ["github-light", "github-dark"],
      langs: [
        "typescript", "javascript", "json",
        "css", "html", "markdown", "python", "yaml"
      ],
    });
  }
  return highlighterInstance;
}

export async function highlightCode(
  code: string,
  language: string,
  theme: "github-light" | "github-dark"
): Promise<string> {
  const highlighter = await getShikiHighlighter();

  // Check if language is supported
  const supportedLangs = highlighter.getLoadedLanguages();
  if (!supportedLangs.includes(language as any)) {
    // Fallback: return entity-encoded plain text
    return escapeHtml(code);
  }

  return highlighter.codeToHtml(code, {
    lang: language,
    theme,
  });
}
```

**Caching strategy**:
- Highlighter instance created once (singleton)
- Per-file highlighting results cached in a `Map<filePath, { light: string, dark: string }>`
- Cache invalidated when pipeline run changes (new fileChanges data)
- Cache size bounded by number of files in pipeline output (typically < 50)

### diff Library over alternatives (Diff Computation)

**Decision**: `diff` npm package for line-level diff computation.

**Rationale**:
- Implements Myers diff algorithm -- optimal edit distance for line-level comparison
- `diffLines()` API returns structured change objects (added/removed/common)
- Minimal API surface -- no configuration needed for basic use case
- ~5KB minified -- negligible bundle impact
- Widely used (50M+ weekly downloads) -- well-tested, stable
- Pure function -- no side effects, no async, no DOM dependency

**Alternatives considered**:

| Alternative | Why rejected |
|-------------|-------------|
| jsdiff (same as diff) | Same package, different name reference. Using the canonical `diff` package. |
| Custom diff implementation | Reimplementing Myers is error-prone. Edge cases (empty files, binary content, large files) already handled by diff library. |
| git diff (server-side) | Requires Git installation on server. Files are not in a Git repo (they're in-memory JSON). Overkill for comparing two strings. |
| diff-match-patch (Google) | Character-level diff is too granular for code review. Line-level comparison is more appropriate. Larger bundle. |
| fast-diff | Character-level diff. Not suitable for line-by-line code comparison. |

### diff Integration Pattern

```typescript
// lib/services/diff-service.ts
import { diffLines, type Change } from "diff";

interface DiffLine {
  lineNumber: number;
  content: string;
  type: "added" | "removed" | "unchanged";
}

interface DiffHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: DiffLine[];
}

export function computeLineDiff(
  originalContent: string,
  modifiedContent: string,
  contextLines: number = 3
): DiffHunk[] {
  const changes: Change[] = diffLines(originalContent, modifiedContent);

  // Convert Change objects to DiffLine[] with line numbers
  // Group into hunks with contextLines of surrounding unchanged content
  // Return structured DiffHunk array
}
```

### DiffViewer Component Architecture (Virtual Diffs)

**Decision**: Render diffs as a flat list of DiffLine components within a single scroll container.

**Rationale**:
- Side-by-side view uses CSS Grid with two columns sharing one scroll container
- Lines aligned by row index -- added lines leave empty cell in left column, removed lines leave empty cell in right column
- Single scroll container eliminates scroll synchronization problems
- For files up to 2,000 lines, direct DOM rendering is performant (< 300ms per NFR-06-002)
- Files > 10,000 lines truncated (NFR-06-005) -- virtual scrolling unnecessary

**Layout pattern**:
```
+---------------------------------------------------+
| @@ -10,5 +10,7 @@ (hunk header, full width)       |
+------------------------+--------------------------+
| 10 | const foo = "bar"; | 10 | const foo = "bar";  |  unchanged
| 11 | let x = 1;         | 11 | let x = 1;          |  unchanged
| 12 | return x;          |    |                      |  removed (red bg)
|    |                    | 12 | const y = 2;         |  added (green bg)
|    |                    | 13 | return x + y;        |  added (green bg)
| 13 | }                  | 14 | }                    |  unchanged
+------------------------+--------------------------+
```

**Alternatives considered**:

| Alternative | Why rejected |
|-------------|-------------|
| Separate scroll containers (synced) | Scroll sync is notoriously fragile. Race conditions between two scroll events. Performance overhead of dual event listeners. |
| react-diff-viewer | Additional dependency (~30KB). Opinionated styling conflicts with Tailwind. Limited customization of line rendering. |
| Monaco Diff Editor | ~2MB bundle. Full editor capabilities unnecessary. Cannot easily integrate with Tailwind styling. |
| Unified diff (single column) | Less readable for code review. Side-by-side is industry standard (GitHub, GitLab). Unified mode used only as mobile fallback. |

### Responsive Diff Layout

**Decision**: Side-by-side on desktop/tablet, unified on mobile.

| Breakpoint | Diff Mode | Implementation |
|-----------|-----------|----------------|
| Desktop (>= 1280px) | Side-by-side | CSS Grid `grid-template-columns: 1fr 1fr`. Full file tree visible (250px sidebar). |
| Tablet (>= 768px) | Side-by-side | CSS Grid `grid-template-columns: 1fr 1fr`. File tree collapsed to icons (48px). |
| Mobile (>= 375px) | Unified (single column) | Single column. Added lines green bg, removed lines red bg, unchanged neutral. File tree replaced by dropdown select. |

### Code Display Component Choices

**Decision**: Custom DiffLine component with Shiki-highlighted spans.

**Rationale**:
- Shiki returns HTML strings with `<span>` tokens for syntax-highlighted segments
- DiffLine component renders: line number gutter + highlighted code content
- Line number gutter is a fixed-width column (4ch for files up to 9999 lines)
- Added/removed background colors applied to the row container, not individual spans (preserving Shiki's syntax colors on top)
- Monospace font: `font-mono` (Tailwind) with `tabSize: 2` CSS property

**Component hierarchy**:
```
DiffReviewPanel (Sheet)
  +-- FileTree (left sidebar)
  |     +-- FileTreeNode (recursive)
  +-- DiffViewer (main content)
  |     +-- DiffHunkHeader (separator)
  |     +-- DiffLineRow (grid row)
  |           +-- LineNumber (left gutter)
  |           +-- CodeContent (Shiki HTML, left column)
  |           +-- LineNumber (right gutter)
  |           +-- CodeContent (Shiki HTML, right column)
  +-- ReviewActions (fixed bottom bar)
        +-- ApproveButton
        +-- RequestChangesButton -> RequestChangesForm
        +-- RetryButton -> ConfirmDialog
```

---

## Styling Decisions

### Diff Color Scheme

| Element | Light Mode | Dark Mode |
|---------|------------|-----------|
| Added line background | `bg-emerald-50` | `bg-emerald-950/20` |
| Added line gutter | `bg-emerald-100` | `bg-emerald-900/30` |
| Removed line background | `bg-red-50` | `bg-red-950/20` |
| Removed line gutter | `bg-red-100` | `bg-red-900/30` |
| Unchanged line background | `bg-transparent` | `bg-transparent` |
| Hunk header background | `bg-blue-50` | `bg-blue-950/20` |
| Line number text | `text-muted-foreground` | `text-muted-foreground` |
| Selected file highlight | `bg-accent` | `bg-accent` |

### Shiki Theme Mapping

| App Theme | Shiki Theme | Usage |
|-----------|-------------|-------|
| Light mode | `github-light` | Syntax tokens colored for light backgrounds |
| Dark mode | `github-dark` | Syntax tokens colored for dark backgrounds |

**Theme switching**: Detect `dark` class on `<html>` element (Tailwind dark mode). Pass corresponding Shiki theme to `highlightCode()`. Re-highlight on theme change (cached results invalidated by theme key).

### FileTree Action Badge Styling

| Action | Badge Text | Background | Text | Border |
|--------|-----------|------------|------|--------|
| create | Added | `bg-emerald-100` | `text-emerald-700` | `border-emerald-200` |
| modify | Modified | `bg-amber-100` | `text-amber-700` | `border-amber-200` |
| delete | Deleted | `bg-red-100` | `text-red-700` | `border-red-200` |

---

## Version Pinning

| Package | Pinned Version | Notes |
|---------|---------------|-------|
| shiki | x.x.x | Pin to latest stable at UOW-06 implementation start. Update only at UOW boundaries or for security patches. |
| diff | x.x.x | Pin to latest stable at UOW-06 implementation start. Mature package with infrequent releases. |

### Compatibility

| Dependency | Requires | Notes |
|-----------|----------|-------|
| shiki | Node 16+ / Modern browser | ESM-first. Async API compatible with React 19 Suspense. Works in Next.js App Router (client component). |
| diff | Node 12+ / Any browser | Pure JavaScript. No native dependencies. CJS and ESM dual-published. |

---

## Infrastructure Impact

### Bundle Size Impact

| Package | Estimated Size (gzipped) | Loaded When |
|---------|------------------------|-------------|
| shiki (core + 8 languages + 2 themes) | ~300KB | Lazy-loaded on DiffReviewPanel open (dynamic import) |
| diff | ~5KB | Imported in DiffService (tree-shaken to diffLines only) |

**Mitigation for Shiki bundle**:
- Dynamic import: `const shiki = await import("shiki")` only when DiffReviewPanel opens
- Language grammars loaded on demand: only the language of the selected file
- Highlighter instance cached -- subsequent file selections reuse loaded grammars
- Next.js code splitting ensures Shiki is not in the initial page bundle

### Environment Variables

No new environment variables. All UOW-06 configuration is code-level.

### Database Impact

No new tables or columns. Review actions use existing pipeline API routes (UOW-04) and existing Task status updates. Settings profile update uses existing User model.

### Network

- No new external API calls (Shiki and diff run entirely client-side/server-side)
- Review action API calls use existing endpoints (approve, request-changes, retry)
- Settings profile update adds one new endpoint: `PATCH /api/auth/me`
