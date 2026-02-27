# NFR Requirements -- UOW-06: Diff Review & Polish

## Overview

Non-functional requirements for UOW-06 scoped to: diff review panel, file tree navigation, side-by-side diff viewer with syntax highlighting, review actions (approve, request changes, retry), error handling UX, and settings page. Each NFR has a unique ID (NFR-06-XXX), measurable target, verification method, and SECURITY rule mapping where applicable.

**Baseline**: UOW-01 NFRs (NFR-01-001 through NFR-01-023) apply as inherited requirements. UOW-04 NFRs (NFR-04-001 through NFR-04-018) apply for all pipeline API and SSE concerns. UOW-05 NFRs (NFR-05-001 through NFR-05-019) apply for all animation and real-time UI concerns. This document covers ADDITIONAL unit-specific concerns introduced by diff rendering, code display, review workflows, and settings management.

---

## Performance

### NFR-06-001: Diff Panel Open Time

| Field | Value |
|-------|-------|
| **Category** | Performance |
| **Requirement** | DiffReviewPanel must open and render first file diff within 500ms |
| **Metric/Target** | Time from pipeline-complete SSE event (result = "passed") to first visible diff content in DiffReviewPanel < 500ms. Includes: DiffService.buildFileTree(), DiffService.computeDiffs() for first file, Shiki syntax highlighting for first file, Framer Motion slide-in animation. |
| **SECURITY Mapping** | N/A |
| **Verification** | Trigger pipeline completion. Measure time from SSE event receipt to first visible diff lines in the panel (via Performance API marks). Must be < 500ms. Test with a pipeline output of 10 files, largest file 500 lines. Chrome DevTools Performance trace shows no long tasks during panel open. |

### NFR-06-002: Diff Rendering for Large Files

| Field | Value |
|-------|-------|
| **Category** | Performance |
| **Requirement** | Diff viewer must render files up to 2,000 lines without visible lag |
| **Metric/Target** | Selecting a file with 2,000 lines of diff content renders in < 300ms. Scrolling through 2,000-line diff at 60 FPS. Side-by-side columns scroll synced without lag. Syntax highlighting applied without blocking main thread (Shiki runs in async mode or is pre-computed). |
| **SECURITY Mapping** | N/A |
| **Verification** | Seed pipelineStore with a file change containing 2,000 lines. Select file in FileTree. Measure render time via React DevTools Profiler -- must be < 300ms. Scroll through diff -- Chrome DevTools Performance panel shows >= 55 FPS. Verify syntax highlighting is present on rendered lines. |

### NFR-06-003: File Tree Navigation Speed

| Field | Value |
|-------|-------|
| **Category** | Performance |
| **Requirement** | File tree expand/collapse and file selection must respond within 50ms |
| **Metric/Target** | Click on directory node: children toggle visible in < 50ms. Click on file node: DiffViewer updates with new file diff in < 200ms (includes Shiki highlighting). FileTree with 50 files renders initial tree in < 100ms. |
| **SECURITY Mapping** | N/A |
| **Verification** | Seed FileChanges with 50 files across nested directories. Render DiffReviewPanel. Click directory to expand -- children visible in < 50ms. Click file -- diff content changes in < 200ms. Measure via React DevTools Profiler. No frame drops during rapid file switching. |

### NFR-06-004: Syntax Highlighting Performance

| Field | Value |
|-------|-------|
| **Category** | Performance |
| **Requirement** | Shiki syntax highlighting must not block the main thread for more than 100ms |
| **Metric/Target** | Shiki highlighting for a 500-line file completes in < 100ms. For files > 500 lines, highlighting runs asynchronously (Web Worker or async Shiki API) to avoid blocking UI. Highlighting is cached per file -- switching back to a previously highlighted file uses cached result (< 10ms). |
| **SECURITY Mapping** | N/A |
| **Verification** | Select a 500-line TypeScript file. Chrome DevTools Performance panel shows Shiki task < 100ms. Select a 2,000-line file -- verify no long task > 100ms (async highlighting). Switch back to first file -- verify instant render (cached). Monitor main thread -- no blocking > 100ms attributed to Shiki. |

### NFR-06-005: Truncation for Oversized Files

| Field | Value |
|-------|-------|
| **Category** | Performance |
| **Requirement** | Files exceeding 10,000 lines must be truncated with a visible indicator |
| **Metric/Target** | DiffService.computeDiffs() truncates output at 10,000 lines per file. Truncated files show indicator line: "--- File truncated (>10,000 lines) ---". No attempt to highlight or render beyond 10,000 lines. Memory bounded regardless of file size. |
| **SECURITY Mapping** | N/A |
| **Verification** | Seed FileChanges with a file containing 15,000 lines. Open in DiffViewer. Verify only 10,000 lines rendered. Truncation indicator visible at bottom. DevTools Memory tab shows bounded allocation (no 15,000-line DOM). Scroll to bottom of diff -- truncation message visible. |

---

## Security

### NFR-06-006: XSS Prevention in Code Display

| Field | Value |
|-------|-------|
| **Category** | Security |
| **Requirement** | Code displayed in DiffViewer must be safe from XSS, even if agent-generated code contains script tags |
| **Metric/Target** | All code content rendered via React JSX text interpolation or Shiki HTML output (which entity-encodes all tokens). No use of `dangerouslySetInnerHTML` with raw user/agent content. If Shiki returns pre-highlighted HTML, it is rendered via `dangerouslySetInnerHTML` ONLY on Shiki's sanitized output (Shiki entity-encodes all input tokens). No raw agent content passed to innerHTML. |
| **SECURITY Mapping** | SECURITY-05 (Input Validation) |
| **Verification** | Inject file content containing: `<script>alert('xss')</script>`, `<img onerror="alert(1)" src=x>`, `onmouseover="alert(1)"` as attribute in code. Render in DiffViewer. No script execution. All payloads display as literal code text with syntax highlighting. Inspect rendered DOM -- no unescaped HTML event handlers. |

### NFR-06-007: Sanitization of Agent-Generated File Paths

| Field | Value |
|-------|-------|
| **Category** | Security |
| **Requirement** | File paths in FileTree must be sanitized against path traversal and XSS |
| **Metric/Target** | DiffService.buildFileTree() rejects or sanitizes: paths containing `../`, absolute paths starting with `/`, paths with null bytes, paths containing HTML/script tags. Invalid paths logged and omitted from tree (not displayed). |
| **SECURITY Mapping** | SECURITY-05 (Input Validation) |
| **Verification** | Inject file changes with paths: `../../etc/passwd`, `/root/.ssh/id_rsa`, `src/<script>alert(1)</script>/file.ts`, `src/file\x00.ts`. Verify: traversal paths rejected (not in tree), absolute paths rejected, script-tag paths display as escaped text or rejected, null-byte paths rejected. Console shows validation warning for each rejected path. |

### NFR-06-008: Review Action CSRF Protection

| Field | Value |
|-------|-------|
| **Category** | Security |
| **Requirement** | All review action endpoints must be protected against CSRF |
| **Metric/Target** | POST `/api/pipeline/[taskId]/approve`, POST `/api/pipeline/[taskId]/request-changes`, and POST `/api/pipeline/[taskId]/retry` inherit better-auth CSRF protection (UOW-01 baseline). State-changing requests without valid CSRF token return 403. |
| **SECURITY Mapping** | SECURITY-08 (Application-Level Access Control) |
| **Verification** | Attempt POST to `/api/pipeline/[taskId]/approve` from a different origin (via `curl` without CSRF token). Request rejected with 403. Legitimate request from same-origin with CSRF token succeeds. Verify better-auth CSRF middleware is applied to all pipeline API routes. |

### NFR-06-009: API Key Secure Handling in Review Actions

| Field | Value |
|-------|-------|
| **Category** | Security |
| **Requirement** | Review actions requiring API key (request-changes, retry) must transmit key securely and not persist it |
| **Metric/Target** | API key sent via `x-anthropic-key` request header (not in request body or URL). Server extracts key from header and passes directly to PipelineOrchestrator. Key never written to DB, logs, response body, or SSE events. Key held in memory only for the duration of the pipeline execution. |
| **SECURITY Mapping** | SECURITY-12 (Authentication and Credential Management) |
| **Verification** | Trigger request-changes with feedback. Inspect network request -- API key in header only (not body, not URL query param). Search server logs for `sk-ant-` -- zero results. Inspect PipelineRun DB record -- no API key stored. SSE events for resumed pipeline contain no key data. |

### NFR-06-010: Settings Page Input Validation

| Field | Value |
|-------|-------|
| **Category** | Security |
| **Requirement** | All Settings page inputs must be validated client-side and server-side |
| **Metric/Target** | Profile name: non-empty, max 100 characters, trimmed, Zod-validated on both client and server. API key: format validation (`sk-ant-*` prefix), client-side only (never sent to own server for storage). Malformed inputs return field-level error messages. No server errors (500) from invalid settings input. |
| **SECURITY Mapping** | SECURITY-05 (Input Validation) |
| **Verification** | Submit profile with: empty name (expect error), 101-character name (expect error), name with HTML tags (expect sanitized or rejected), SQL injection string (expect safe handling). All return 400 with field-level validation errors. No 500 errors. API key form: enter malformed key (no `sk-ant-` prefix) -- expect client-side validation error before submission. |

---

## Reliability

### NFR-06-011: Review State Persistence During Session

| Field | Value |
|-------|-------|
| **Category** | Reliability |
| **Requirement** | If user navigates away from TaskDetailView during review, returning must restore the review state |
| **Metric/Target** | Pipeline completion result (fileChanges, reviewFindings) persisted in pipelineStore (Zustand in-memory). Navigating to board and back to task detail restores DiffReviewPanel state: same file selected, scroll position best-effort. If page is hard-refreshed, review state recovered from `GET /api/pipeline/[taskId]/status` (returns fileChanges and reviewFindings from DB). |
| **SECURITY Mapping** | N/A |
| **Verification** | Complete a pipeline (task in "review" status). Open DiffReviewPanel, select third file, scroll down. Navigate to board page. Navigate back to task detail. Verify: DiffReviewPanel re-opens, file tree visible, previously selected file restored (or defaults to first file). Hard refresh page -- verify pipeline status API returns fileChanges and panel can reconstruct. |

### NFR-06-012: Approve Action Idempotency

| Field | Value |
|-------|-------|
| **Category** | Reliability |
| **Requirement** | Approve action must be idempotent -- multiple clicks or network retries must not cause errors |
| **Metric/Target** | If approve is called when task is already in "done" status, server returns 200 OK (not 400 or 409). UI prevents double-click via button disable during API call. If network retry sends duplicate approve, server recognizes task already approved and returns success. |
| **SECURITY Mapping** | N/A |
| **Verification** | Click Approve. While request is in-flight, verify button is disabled (non-clickable). Send duplicate POST `/api/pipeline/[taskId]/approve` -- expect 200 OK (not error). Verify task remains in "done" status. No duplicate SSE events or state corruption. |

### NFR-06-013: Error Toast Auto-Dismiss

| Field | Value |
|-------|-------|
| **Category** | Reliability |
| **Requirement** | Error toasts must auto-dismiss after 10 seconds but remain dismissible by user |
| **Metric/Target** | Pipeline error toasts (Sonner) display for 10 seconds then auto-dismiss. User can dismiss earlier by clicking X or swiping. Error toasts include "Retry" action button. Success toasts auto-dismiss after 3 seconds. Max 3 stacked toasts at any time (oldest dismissed when 4th arrives). |
| **SECURITY Mapping** | N/A |
| **Verification** | Trigger pipeline error. Verify toast appears with error message and Retry button. Wait 10 seconds -- toast auto-dismisses. Trigger again -- click X before 10s -- toast dismissed immediately. Trigger 4 errors rapidly -- verify max 3 toasts visible, oldest replaced by newest. |

### NFR-06-014: Request Changes Feedback Persistence

| Field | Value |
|-------|-------|
| **Category** | Reliability |
| **Requirement** | If request-changes API call fails, user's typed feedback must not be lost |
| **Metric/Target** | RequestChangesForm preserves textarea content on API failure. Error toast shown. Form remains open with feedback text intact. User can retry submission without retyping. Feedback cleared only on successful submission or manual panel close. |
| **SECURITY Mapping** | N/A |
| **Verification** | Open RequestChangesForm, type 50 characters of feedback. Simulate network failure (DevTools offline). Click Submit -- expect error toast. Verify textarea still contains typed feedback. Re-enable network. Click Submit again -- expect success. Verify feedback cleared after successful submission. |

---

## Usability

### NFR-06-015: Keyboard Navigation for Diff Viewer

| Field | Value |
|-------|-------|
| **Category** | Usability |
| **Requirement** | DiffReviewPanel must support keyboard-only operation |
| **Metric/Target** | Tab navigates between: FileTree, DiffViewer, ReviewActions. Within FileTree: Arrow Up/Down moves selection, Enter expands/collapses directory or selects file, Left collapses current directory, Right expands directory. Within DiffViewer: Arrow Up/Down scrolls, Page Up/Down for fast scroll. Within ReviewActions: Tab between Approve/Request Changes/Retry, Enter activates. Escape closes DiffReviewPanel. All interactive elements have visible 2px focus ring. |
| **SECURITY Mapping** | N/A |
| **Verification** | Open DiffReviewPanel using keyboard only. Tab into FileTree -- navigate files with arrows, select with Enter. Tab to DiffViewer -- scroll with arrows. Tab to ReviewActions -- activate Approve with Enter. Press Escape -- panel closes. All elements show visible focus indicator. No focus traps (except within modal dialogs like retry confirmation). |

### NFR-06-016: Accessible Code Display

| Field | Value |
|-------|-------|
| **Category** | Usability |
| **Requirement** | Diff viewer must be accessible to screen readers |
| **Metric/Target** | DiffViewer has `role="region"` with `aria-label="Code diff for {filename}"`. Line numbers have `aria-hidden="true"` (decorative). Added lines announced as "added" (via `aria-label` or visually hidden text). Removed lines announced as "removed". Unchanged lines have no special announcement. Hunk headers are `role="separator"`. File action badge (Added/Modified/Deleted) announced by screen reader. |
| **SECURITY Mapping** | N/A |
| **Verification** | Enable VoiceOver (macOS) or NVDA (Windows). Navigate to DiffViewer. Verify: region announced with filename, added lines announced as "line [number] added: [content]", removed lines announced as "line [number] removed: [content]". Hunk separators announced. File tree nodes announce file name and action (e.g., "schema.ts, Added"). |

### NFR-06-017: Side-by-Side Responsive Layout

| Field | Value |
|-------|-------|
| **Category** | Usability |
| **Requirement** | DiffReviewPanel must adapt layout for different screen sizes |
| **Metric/Target** | Desktop (>= 1280px): FileTree (250px) + DiffViewer (remaining), side-by-side diff (two columns). Tablet (>= 768px): FileTree collapsed to icon-only (48px), side-by-side diff. Mobile (>= 375px): FileTree as dropdown select, unified diff (single column, added/removed inline with color coding). Panel width: 80vw desktop, 100vw mobile, max 1200px. |
| **SECURITY Mapping** | N/A |
| **Verification** | Resize browser to 1280px, 768px, and 375px. At each breakpoint: verify layout matches specification, no horizontal overflow, all content reachable, diff lines readable. At 375px: verify unified diff mode (not side-by-side), file selection via dropdown. |

### NFR-06-018: Review Action Confirmation

| Field | Value |
|-------|-------|
| **Category** | Usability |
| **Requirement** | Destructive review actions must require confirmation |
| **Metric/Target** | Retry (full restart) shows AlertDialog: "Retry will restart the entire pipeline from the Planning stage. Current code changes will be discarded. Continue?" with [Cancel] and [Confirm Retry] buttons. Approve does NOT require confirmation (non-destructive, desired action). Request Changes does NOT require confirmation (user already typed feedback). All action buttons show loading spinner during API call and disable to prevent double-click. |
| **SECURITY Mapping** | N/A |
| **Verification** | Click Retry -- verify AlertDialog appears with warning text. Click Cancel -- dialog closes, no action taken. Click Retry again, then Confirm -- verify pipeline restarts. Click Approve -- verify no confirmation dialog, action proceeds immediately. Submit Request Changes -- verify no confirmation dialog. During all API calls: verify button shows spinner and is non-clickable. |

### NFR-06-019: Settings Page Form UX

| Field | Value |
|-------|-------|
| **Category** | Usability |
| **Requirement** | Settings forms must provide clear feedback for all states |
| **Metric/Target** | Profile form: unsaved changes show warning on navigation attempt. Save button disabled until form is dirty. Success toast on save. Field-level errors display inline below input. API key form: masked display (`sk-ant-...xxxx`), copy button copies full key from localStorage, remove confirmation dialog. Tab navigation between Settings tabs preserves unsaved state within each tab. |
| **SECURITY Mapping** | N/A |
| **Verification** | Edit profile name. Attempt navigation -- verify unsaved changes warning. Click Save -- verify toast "Profile updated". Enter invalid name (empty) -- verify inline error below input. Switch to API Key tab and back -- verify profile form retains unsaved changes. API key: add key, verify masked display. Click copy -- verify clipboard contains full key. Click remove -- verify confirmation dialog. |

---

## Maintainability

### NFR-06-020: DiffService as Pure Utility

| Field | Value |
|-------|-------|
| **Category** | Maintainability |
| **Requirement** | DiffService must be a pure utility module with no side effects |
| **Metric/Target** | `lib/services/diff-service.ts` exports pure functions only: `buildFileTree(fileChanges) -> FileTreeNode[]` and `computeDiffs(fileChanges) -> UnifiedDiff[]`. No store access, no API calls, no DOM manipulation, no async operations. All functions are deterministic (same input = same output). Fully unit-testable without mocking. |
| **SECURITY Mapping** | N/A |
| **Verification** | Inspect `diff-service.ts`. Zero imports from stores, API clients, or DOM APIs. Functions accept typed parameters and return typed results. Write unit test: `expect(computeDiffs(sampleFileChanges)).toEqual(expectedDiffs)` -- passes deterministically. No `window`, `document`, or `fetch` references. |

### NFR-06-021: Shared Validation Schemas

| Field | Value |
|-------|-------|
| **Category** | Maintainability |
| **Requirement** | Review action request bodies must use shared Zod schemas between client and server |
| **Metric/Target** | `lib/validations/pipeline-schemas.ts` exports: `requestChangesSchema` (feedback: string, min 10 chars), `approveSchema` (empty body or taskId), `retrySchema` (empty body or taskId). Client forms import and validate before submission. Server API routes import same schemas for server-side validation. No duplicate validation logic. |
| **SECURITY Mapping** | SECURITY-05 (Input Validation) |
| **Verification** | Inspect `pipeline-schemas.ts`. Verify `requestChangesSchema` validates feedback min length. Search for duplicate Zod schemas in component files and API routes -- must find only imports. Client-side validation prevents submission of invalid data. Server-side validation rejects the same invalid data independently. |

### NFR-06-022: Component File Size

| Field | Value |
|-------|-------|
| **Category** | Maintainability |
| **Requirement** | No single component file should exceed 200 lines |
| **Metric/Target** | `diff-review-panel.tsx` < 200 lines (orchestrator only, delegates to child components). `file-tree.tsx` < 200 lines. `diff-viewer.tsx` < 200 lines (may extract `DiffLine` sub-component). `review-actions.tsx` < 200 lines. Settings page components < 200 lines each. If a component grows beyond 200 lines, extract sub-components. |
| **SECURITY Mapping** | N/A |
| **Verification** | Run `wc -l` on all component files in `components/diff-review/` and `components/settings/`. All must be < 200 lines. If any exceed, refactor into sub-components with clear single responsibilities. |

### NFR-06-023: TypeScript Strict Compliance

| Field | Value |
|-------|-------|
| **Category** | Maintainability |
| **Requirement** | All UOW-06 code must pass TypeScript strict mode with zero errors |
| **Metric/Target** | `npx tsc --noEmit` exits with code 0 after all UOW-06 files added. No `@ts-ignore` or `: any` types except with documented justification. Shiki types properly imported (`@types/shiki` or inline from package). DiffService input/output types fully specified. |
| **SECURITY Mapping** | N/A |
| **Verification** | Run `npx tsc --noEmit` -- must exit 0. Search UOW-06 files for `@ts-ignore` and `: any` -- must find zero or justified occurrences. All function parameters and return types explicitly annotated. |

---

## SECURITY Compliance Matrix

Mapping of all 15 SECURITY baseline rules to UOW-06 applicability. Rules already fully covered by earlier UOWs are marked "Inherited".

| SECURITY Rule | Rule Name | Applicable to UOW-06? | Implementation | NFR ID |
|---------------|-----------|----------------------|----------------|--------|
| SECURITY-01 | Encryption at Rest and in Transit | Inherited | UOW-01 baseline applies. API key encrypted in localStorage (AES-GCM). All API calls over HTTPS in production. | -- (UOW-01) |
| SECURITY-02 | Access Logging on Network Intermediaries | N/A | No new network infrastructure in UOW-06 scope. | -- |
| SECURITY-03 | Application-Level Logging | Inherited | UOW-04 structured logging applies to review action endpoints. Review actions logged with taskId correlation ID. No PII in logs. | -- (UOW-04) |
| SECURITY-04 | HTTP Security Headers | Inherited | UOW-01 middleware applies to all routes including review action endpoints and settings API. | -- (UOW-01) |
| SECURITY-05 | Input Validation | Yes -- Extended | XSS prevention in code display via Shiki entity-encoding + React JSX escaping (NFR-06-006). File path sanitization (NFR-06-007). Settings input validation (NFR-06-010). Shared Zod schemas for review actions (NFR-06-021). Request-changes feedback validated (min 10 chars). | NFR-06-006, NFR-06-007, NFR-06-010, NFR-06-021 |
| SECURITY-06 | Least-Privilege Access | Inherited | Review action endpoints validate task ownership. Settings profile update scoped to authenticated user. | NFR-06-008 |
| SECURITY-07 | Restrictive Network Configuration | N/A | No new network infrastructure. | -- |
| SECURITY-08 | Application-Level Access Control | Yes -- Extended | CSRF protection on all review action endpoints (NFR-06-008). Review actions validate pipeline state prerequisites (task in "review" status, pipeline "passed"). Approve/request-changes only available for task owner. | NFR-06-008 |
| SECURITY-09 | Hardening and Misconfiguration Prevention | Inherited | UOW-01 baseline applies. Error responses from review actions are generic (no stack traces). Settings page does not expose server configuration. | -- (UOW-01) |
| SECURITY-10 | Software Supply Chain Security | Partial | Shiki and diff library pinned to exact versions. Lock file updated. Packages from official npm registry. | -- (tech-stack-decisions.md) |
| SECURITY-11 | Secure Design Principles | Inherited | File truncation prevents resource exhaustion (NFR-06-005). Retry confirmation dialog prevents accidental pipeline restart. Button disable prevents double-submission. | NFR-06-005, NFR-06-018 |
| SECURITY-12 | Authentication and Credential Management | Yes -- Extended | API key transmitted via header only, never in request body or URL (NFR-06-009). API key never logged or stored server-side. Settings API key form uses AES-GCM encryption in localStorage. Masked display prevents shoulder surfing. | NFR-06-009 |
| SECURITY-13 | Software and Data Integrity | Inherited | Shiki loaded from local bundle (no CDN). Diff library from npm with lock file. No external script loading. | -- |
| SECURITY-14 | Alerting and Monitoring | N/A | No new alerting infrastructure. Error toasts provide user-facing notifications. Server-side errors logged via SECURITY-03. | -- |
| SECURITY-15 | Exception Handling and Fail-Safe Defaults | Yes -- Extended | Approve idempotency prevents state corruption (NFR-06-012). Feedback preserved on API failure (NFR-06-014). Error toasts auto-dismiss with retry option (NFR-06-013). File path validation rejects malicious paths gracefully (NFR-06-007). Large file truncation prevents memory exhaustion (NFR-06-005). | NFR-06-005, NFR-06-007, NFR-06-012, NFR-06-013, NFR-06-014 |

---

## NFR Summary Matrix

| NFR ID | Category | Short Description | Target | SECURITY Rule |
|--------|----------|------------------|--------|---------------|
| NFR-06-001 | Performance | Diff panel open time | < 500ms to first visible diff | -- |
| NFR-06-002 | Performance | Large file diff rendering | 2,000 lines at 60 FPS | -- |
| NFR-06-003 | Performance | File tree navigation | < 50ms expand, < 200ms file select | -- |
| NFR-06-004 | Performance | Syntax highlighting | < 100ms per 500 lines, async for larger | -- |
| NFR-06-005 | Performance | File truncation | 10,000 line cap with indicator | -- |
| NFR-06-006 | Security | XSS in code display | Shiki entity-encoding + React escaping | SECURITY-05 |
| NFR-06-007 | Security | File path sanitization | Reject traversal, absolute, null-byte paths | SECURITY-05 |
| NFR-06-008 | Security | Review action CSRF | better-auth CSRF on all POST endpoints | SECURITY-08 |
| NFR-06-009 | Security | API key handling | Header-only transmission, never persisted | SECURITY-12 |
| NFR-06-010 | Security | Settings input validation | Zod on client + server, field-level errors | SECURITY-05 |
| NFR-06-011 | Reliability | Review state persistence | Zustand in-memory + DB fallback on refresh | -- |
| NFR-06-012 | Reliability | Approve idempotency | Duplicate approve returns 200 OK | -- |
| NFR-06-013 | Reliability | Error toast lifecycle | 10s auto-dismiss, max 3 stacked | -- |
| NFR-06-014 | Reliability | Feedback preservation | Textarea content survives API failure | -- |
| NFR-06-015 | Usability | Keyboard navigation | Full Tab/Arrow/Enter/Escape support | -- |
| NFR-06-016 | Usability | Screen reader a11y | ARIA roles, labels, line announcements | -- |
| NFR-06-017 | Usability | Responsive layout | Side-by-side desktop, unified mobile | -- |
| NFR-06-018 | Usability | Action confirmation | Retry requires confirmation dialog | -- |
| NFR-06-019 | Usability | Settings form UX | Unsaved warning, inline errors, masked key | -- |
| NFR-06-020 | Maintainability | DiffService purity | Pure functions, no side effects | -- |
| NFR-06-021 | Maintainability | Shared schemas | Single Zod source, client + server | SECURITY-05 |
| NFR-06-022 | Maintainability | File size limit | < 200 lines per component file | -- |
| NFR-06-023 | Maintainability | TypeScript strict | Zero errors, no untyped code | -- |
