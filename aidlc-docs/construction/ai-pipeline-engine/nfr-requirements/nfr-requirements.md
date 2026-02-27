# NFR Requirements -- UOW-04: AI Pipeline Engine

## Overview

Non-functional requirements for UOW-04 scoped to: AI agent orchestration, SSE streaming, pipeline state management, Anthropic SDK integration, and pipeline API endpoints. Each NFR has a unique ID (NFR-04-XXX), measurable target, verification method, and SECURITY rule mapping where applicable.

**Baseline**: UOW-01 NFRs (NFR-01-001 through NFR-01-023) apply as inherited requirements. This document covers ADDITIONAL unit-specific concerns introduced by AI agent orchestration and real-time streaming.

---

## Performance

### NFR-04-001: SSE Event Delivery Latency

| Field | Value |
|-------|-------|
| **Category** | Performance |
| **Requirement** | SSE event delivery latency must be under 500ms from agent token generation to client render |
| **Metric/Target** | Time from Anthropic SDK `content_block_delta` event to client `onmessage` callback < 500ms. Measured end-to-end including server-side processing and network transit. |
| **SECURITY Mapping** | N/A |
| **Verification** | Instrument timestamps: (1) Anthropic SDK stream callback, (2) SSE `res.write()` call, (3) client `EventSource.onmessage`. Delta between (1) and (3) must be < 500ms on localhost. Log timing samples for first 10 events per pipeline run. |

### NFR-04-002: Pipeline Start Response Time

| Field | Value |
|-------|-------|
| **Category** | Performance |
| **Requirement** | Pipeline start API must respond within 1 second |
| **Metric/Target** | POST `/api/pipeline/start` returns HTTP 200 with `{ pipelineId, status: "running" }` in < 1s. Actual agent execution begins asynchronously after response. |
| **SECURITY Mapping** | N/A |
| **Verification** | Measure response time via browser DevTools Network tab. Pipeline start triggers immediate DB write (status: "running") and returns. Agent orchestration runs in background. Response time must not include agent processing. |

### NFR-04-003: Non-Blocking Agent Execution

| Field | Value |
|-------|-------|
| **Category** | Performance |
| **Requirement** | Agent streaming must not block other API routes |
| **Metric/Target** | While a pipeline is running (agents streaming), concurrent requests to other API routes (e.g., GET `/api/tasks`, GET `/api/auth/me`) must respond within their normal SLA (< 500ms). No event loop blocking. |
| **SECURITY Mapping** | N/A |
| **Verification** | Start a pipeline. While agents are streaming, send 10 concurrent requests to `/api/tasks`. All must return within 500ms. Verify via `async/await` execution model -- no synchronous blocking in pipeline orchestrator. |

### NFR-04-004: SSE Keepalive Interval

| Field | Value |
|-------|-------|
| **Category** | Performance |
| **Requirement** | SSE connection must send keepalive comments every 30 seconds |
| **Metric/Target** | SSE endpoint sends `: keepalive\n\n` comment every 30s during idle periods (between agent phases). Prevents proxy/load-balancer timeout. |
| **SECURITY Mapping** | N/A |
| **Verification** | Connect to SSE endpoint. During gap between agent phases (e.g., after brainstorm completes, before spec starts), monitor for keepalive comments at 30s intervals. Verify via browser DevTools EventStream tab or `curl` with `--no-buffer`. |

---

## Security

### NFR-04-005: API Key Per-Request, Never Stored

| Field | Value |
|-------|-------|
| **Category** | Security |
| **Requirement** | Anthropic API key must be passed per-request in header, never stored server-side |
| **Metric/Target** | API key sent via `X-API-Key` or `Authorization` header on pipeline start. Server passes key directly to Anthropic SDK per agent call. Key never written to DB, logs, files, or environment variables on server. Key held in memory only for request duration. |
| **SECURITY Mapping** | SECURITY-12 (Authentication and Credential Management) |
| **Verification** | Search entire codebase for API key storage patterns: no DB writes containing `sk-ant-`, no `process.env.ANTHROPIC_API_KEY`, no file system writes. Inspect pipeline start handler to confirm key extracted from header and passed to SDK without intermediate storage. Check structured logs for key redaction. |

### NFR-04-006: API Key Validation Before Agent Calls

| Field | Value |
|-------|-------|
| **Category** | Security |
| **Requirement** | API key must be validated before each agent call |
| **Metric/Target** | Before invoking Anthropic SDK, validate: (1) key is present (non-empty string), (2) key matches expected format (`sk-ant-*`), (3) first agent call failure due to invalid key returns 401 to client with `{ error: "Invalid API key" }`. Pipeline does not proceed with invalid key. |
| **SECURITY Mapping** | SECURITY-05 (Input Validation) |
| **Verification** | Send pipeline start with: (a) missing key header -- expect 400. (b) Malformed key (`not-a-key`) -- expect 400. (c) Invalid but well-formed key -- expect 401 after first Anthropic call fails. No stack traces or raw Anthropic error messages in response. |

### NFR-04-007: Agent Output Sanitization

| Field | Value |
|-------|-------|
| **Category** | Security |
| **Requirement** | Agent outputs must be sanitized before storage to prevent stored XSS in logs |
| **Metric/Target** | All agent text output sanitized before writing to `agentLogs` JSON column. HTML entities escaped (`<`, `>`, `"`, `'`, `&`). Markdown preserved (safe for rendering with sanitized markdown renderer). No raw HTML stored. |
| **SECURITY Mapping** | SECURITY-05 (Input Validation) |
| **Verification** | Craft a pipeline where agent output contains `<script>alert('xss')</script>` (via prompt injection test). Verify stored agentLogs contain escaped version: `&lt;script&gt;...`. Render stored logs in UI -- no script execution. Use DOMPurify or equivalent on read path as defense-in-depth. |

### NFR-04-008: Pipeline Endpoint Ownership Enforcement

| Field | Value |
|-------|-------|
| **Category** | Security |
| **Requirement** | Pipeline API endpoints must enforce task ownership |
| **Metric/Target** | All pipeline endpoints (start, status, cancel, logs) validate that `task.userId === session.userId`. Requests for other users' pipelines return 404 (not 403, to prevent enumeration). |
| **SECURITY Mapping** | SECURITY-08 (Application-Level Access Control) |
| **Verification** | Create two users (A, B). User A starts pipeline on their task. User B attempts to access User A's pipeline via: GET `/api/pipeline/{id}/status`, GET `/api/pipeline/{id}/logs`. Both return 404. User A's requests return 200. |

### NFR-04-009: Pipeline Start Rate Limiting

| Field | Value |
|-------|-------|
| **Category** | Security |
| **Requirement** | Max 5 concurrent pipelines per user |
| **Metric/Target** | If user has 5 pipelines with status "running", 6th pipeline start returns 429 with `{ error: "Maximum concurrent pipelines reached. Please wait for existing pipelines to complete." }`. Completed/failed pipelines do not count against limit. |
| **SECURITY Mapping** | SECURITY-11 (Secure Design Principles) |
| **Verification** | Start 5 pipelines for same user (different tasks). 6th attempt returns 429. Wait for one pipeline to complete. Next attempt succeeds. Verify limit is per-user, not global -- different user can start pipelines independently. |

---

## Reliability

### NFR-04-010: Pipeline State Persistence at Phase Transitions

| Field | Value |
|-------|-------|
| **Category** | Reliability |
| **Requirement** | Pipeline state must be persisted in DB at every phase transition |
| **Metric/Target** | DB updated with current phase, status, and partial results when pipeline transitions between phases (e.g., brainstorm -> spec -> design). On server restart, pipeline can be recovered from last persisted state. State includes: `currentPhase`, `phaseStatus`, `phaseResults` (JSON), `updatedAt`. |
| **SECURITY Mapping** | SECURITY-15 (Exception Handling and Fail-Safe Defaults) |
| **Verification** | Start pipeline. After brainstorm phase completes and spec phase begins, kill server process. Restart server. Query DB for pipeline record -- must show `currentPhase: "spec"`, `phaseStatus: "in_progress"` or `"pending"`, and brainstorm results in `phaseResults`. UI can display last known state on reconnect. |

### NFR-04-011: SSE Auto-Reconnect

| Field | Value |
|-------|-------|
| **Category** | Reliability |
| **Requirement** | Client must auto-reconnect SSE on connection drop, max 3 attempts |
| **Metric/Target** | On SSE connection drop (network error, server restart), client retries connection with backoff: attempt 1 at 1s, attempt 2 at 2s, attempt 3 at 4s. After 3 failed attempts, show error state in UI with manual retry button. On reconnect, client receives current pipeline state (catch-up from DB). |
| **SECURITY Mapping** | N/A |
| **Verification** | Start pipeline. During streaming, simulate network drop (DevTools Network > Offline toggle). Observe reconnection attempts in console (1s, 2s, 4s delays). On reconnect, verify client receives current pipeline state. After 3 failures, verify error UI appears with retry button. |

### NFR-04-012: Anthropic API Rate Limit Handling

| Field | Value |
|-------|-------|
| **Category** | Reliability |
| **Requirement** | Pipeline must gracefully handle Anthropic API 429 (rate limit) responses |
| **Metric/Target** | On 429 from Anthropic: (1) respect `Retry-After` header if present, (2) otherwise use exponential backoff (1s, 2s, 4s), (3) max 3 retries per agent call, (4) on exhaustion, mark phase as "rate_limited" and notify client via SSE event. Pipeline pauses, does not fail permanently. |
| **SECURITY Mapping** | SECURITY-15 (Exception Handling and Fail-Safe Defaults) |
| **Verification** | Mock Anthropic SDK to return 429 on first call. Verify retry with backoff (inspect timing between attempts). After 3 retries, verify pipeline phase marked as "rate_limited" in DB. Client receives SSE event `{ type: "rate_limited", phase: "...", message: "..." }`. No unhandled promise rejections. |

### NFR-04-013: Pipeline Timeout

| Field | Value |
|-------|-------|
| **Category** | Reliability |
| **Requirement** | Pipeline must timeout after 10 minutes total duration |
| **Metric/Target** | Pipeline orchestrator sets 10-minute `AbortController` timeout. On timeout: (1) cancel in-flight Anthropic request, (2) mark pipeline as "timed_out" in DB, (3) send SSE event `{ type: "timeout" }`, (4) close SSE connection. Partial results preserved. |
| **SECURITY Mapping** | SECURITY-15 (Exception Handling and Fail-Safe Defaults) |
| **Verification** | Mock a slow agent that takes 11 minutes. Verify pipeline terminates at 10 minutes. DB record shows `status: "timed_out"`, `completedAt` timestamp. SSE connection closed cleanly. Partial phase results from completed phases preserved in DB. |

### NFR-04-014: Exponential Backoff on Retry

| Field | Value |
|-------|-------|
| **Category** | Reliability |
| **Requirement** | All retryable operations must use exponential backoff: 1s, 2s, 4s |
| **Metric/Target** | Retry delays: attempt 1 after 1s, attempt 2 after 2s, attempt 3 after 4s. Applies to: Anthropic API calls (429, 500, network errors), SSE reconnection (client-side). No jitter required for MVP (single-user scenarios). |
| **SECURITY Mapping** | N/A |
| **Verification** | Instrument retry logic with timestamps. On retryable failure, measure delay between attempts. Delays must be 1s (+/- 100ms), 2s (+/- 100ms), 4s (+/- 100ms). Verify no immediate retry (0ms delay). |

---

## Scalability

### NFR-04-015: In-Memory SSE Connection Management

| Field | Value |
|-------|-------|
| **Category** | Scalability |
| **Requirement** | SSE connections managed in-memory for MVP, with documented scaling path |
| **Metric/Target** | Active SSE connections stored in a `Map<pipelineId, Response>` in server memory. Acceptable for single-process MVP. Document future scaling path: Redis pub/sub for multi-process/multi-server deployment. |
| **SECURITY Mapping** | N/A |
| **Verification** | Inspect SSE connection manager code. Confirm `Map` or similar in-memory structure. Verify connections cleaned up on disconnect (no memory leak). Code comments or ADR document Redis pub/sub migration path. Run 10 concurrent SSE connections -- no memory issues. |

### NFR-04-016: One Pipeline Per Task

| Field | Value |
|-------|-------|
| **Category** | Scalability |
| **Requirement** | Only one active pipeline per task at a time |
| **Metric/Target** | If a pipeline with status "running" exists for a task, new pipeline start returns 409 with `{ error: "Pipeline already running for this task" }`. User must wait for completion or cancel existing pipeline. |
| **SECURITY Mapping** | N/A |
| **Verification** | Start pipeline for task A. While running, attempt to start another pipeline for task A. Expect 409 response. Start pipeline for task B (different task) -- succeeds. After task A pipeline completes, new pipeline for task A succeeds. |

---

## Maintainability

### NFR-04-017: Agent Prompts in Separate Files

| Field | Value |
|-------|-------|
| **Category** | Maintainability |
| **Requirement** | Agent prompts must be stored in separate files for independent iteration |
| **Metric/Target** | Each agent's system prompt and user prompt template stored in `/lib/prompts/` directory. One file per agent (e.g., `brainstorm.ts`, `spec.ts`, `design.ts`). Prompt files export typed functions that accept context and return formatted prompt strings. No inline prompt strings in orchestrator logic. |
| **SECURITY Mapping** | N/A |
| **Verification** | Inspect `/lib/prompts/` directory. Each pipeline phase has a corresponding prompt file. Search orchestrator code for multi-line template literals containing agent instructions -- must find zero (all delegated to prompt files). Prompt files have TypeScript input types for context parameters. |

### NFR-04-018: Structured Logging with Correlation ID

| Field | Value |
|-------|-------|
| **Category** | Maintainability |
| **Requirement** | All pipeline operations must use structured logging with taskId as correlation ID |
| **Metric/Target** | Every log entry from pipeline operations includes: `timestamp`, `correlationId` (taskId), `pipelineId`, `phase`, `level`, `message`. Agent call logs additionally include: `model`, `inputTokens`, `outputTokens`, `durationMs`. No API keys or raw user content in logs. |
| **SECURITY Mapping** | SECURITY-03 (Application-Level Logging) |
| **Verification** | Run a full pipeline. Inspect server logs. Filter by `correlationId` (taskId) -- all pipeline-related logs appear. Each agent call log includes token counts and duration. Search logs for `sk-ant-` -- must find zero results. Log format is valid JSON parseable by `JSON.parse()`. |

---

## SECURITY Compliance Matrix

Mapping of all 15 SECURITY baseline rules to UOW-04 applicability. Rules already fully covered by UOW-01 baseline are marked "Inherited".

| SECURITY Rule | Rule Name | Applicable to UOW-04? | Implementation | NFR ID |
|---------------|-----------|----------------------|----------------|--------|
| SECURITY-01 | Encryption at Rest and in Transit | Inherited | UOW-01 baseline applies. Anthropic API calls use HTTPS (SDK default). API key transmitted over HTTPS in production. | -- (UOW-01) |
| SECURITY-02 | Access Logging on Network Intermediaries | N/A | No new network infrastructure in UOW-04 scope. | -- |
| SECURITY-03 | Application-Level Logging | Yes -- Extended | Structured logging extended to pipeline operations. Each agent call logged with model, token usage, duration. Correlation ID = taskId across entire pipeline lifecycle. API keys redacted from all logs. | NFR-04-018 |
| SECURITY-04 | HTTP Security Headers | Inherited | UOW-01 middleware applies to all routes including pipeline API endpoints. CSP updated if SSE requires `connect-src` adjustment. | -- (UOW-01) |
| SECURITY-05 | Input Validation | Yes -- Extended | API key format validation (NFR-04-006). Agent output sanitization before storage (NFR-04-007). Pipeline start request body validated via Zod schema (taskId required, valid UUID). | NFR-04-006, NFR-04-007 |
| SECURITY-06 | Least-Privilege Access | Inherited | Prisma queries scoped to authenticated user's ID. Pipeline queries filtered by `task.userId`. | NFR-04-008 |
| SECURITY-07 | Restrictive Network Configuration | N/A | No new network infrastructure. Anthropic API is outbound HTTPS only. | -- |
| SECURITY-08 | Application-Level Access Control | Yes -- Extended | Pipeline endpoints enforce task ownership. User can only start/view/cancel pipelines for their own tasks. 404 returned for unauthorized access (no enumeration). | NFR-04-008 |
| SECURITY-09 | Hardening and Misconfiguration Prevention | Inherited | UOW-01 baseline applies. Pipeline error responses do not expose Anthropic error details or internal state. Generic error messages for all failure modes. | NFR-04-012, NFR-04-013 |
| SECURITY-10 | Software Supply Chain Security | Partial | `@anthropic-ai/sdk` pinned to exact version. Lock file updated. Package from official npm registry. | -- (tech-stack-decisions.md) |
| SECURITY-11 | Secure Design Principles | Yes -- Extended | Rate limiting on pipeline start (max 5 concurrent per user). One pipeline per task constraint. Defense in depth: validation + auth + rate limit + ownership check layered. | NFR-04-009, NFR-04-016 |
| SECURITY-12 | Authentication and Credential Management | Yes -- Extended | User API key passed per-request, never stored server-side. Key validated before use. Key redacted in all logs. No server-side API key storage in DB, env, or files. | NFR-04-005, NFR-04-006 |
| SECURITY-13 | Software and Data Integrity | Inherited | Anthropic SDK from official npm registry. Pipeline state integrity via DB transactions at phase boundaries. | NFR-04-010 |
| SECURITY-14 | Alerting and Monitoring | Partial | Structured logging provides foundation (SECURITY-03). Pipeline failures, timeouts, and rate limits logged with severity. Alerting infrastructure deferred to Operations phase. | NFR-04-018 |
| SECURITY-15 | Exception Handling and Fail-Safe Defaults | Yes -- Extended | Pipeline timeout prevents runaway execution (NFR-04-013). Anthropic API errors handled gracefully with retry + backoff (NFR-04-012). Pipeline state persisted for recovery (NFR-04-010). SSE connection errors do not crash server. All external API calls wrapped in try/catch. | NFR-04-010, NFR-04-012, NFR-04-013 |

---

## NFR Summary Matrix

| NFR ID | Category | Short Description | Target | SECURITY Rule |
|--------|----------|------------------|--------|---------------|
| NFR-04-001 | Performance | SSE event latency | < 500ms token-to-render | -- |
| NFR-04-002 | Performance | Pipeline start response | < 1s API response | -- |
| NFR-04-003 | Performance | Non-blocking execution | No event loop blocking | -- |
| NFR-04-004 | Performance | SSE keepalive | 30s interval | -- |
| NFR-04-005 | Security | API key per-request | Never stored server-side | SECURITY-12 |
| NFR-04-006 | Security | API key validation | Validate before each agent call | SECURITY-05 |
| NFR-04-007 | Security | Output sanitization | HTML-escape agent output, prevent stored XSS | SECURITY-05 |
| NFR-04-008 | Security | Pipeline ownership | 404 for unauthorized access | SECURITY-08 |
| NFR-04-009 | Security | Pipeline rate limiting | Max 5 concurrent per user | SECURITY-11 |
| NFR-04-010 | Reliability | State persistence | DB write at every phase transition | SECURITY-15 |
| NFR-04-011 | Reliability | SSE auto-reconnect | 3 attempts, exponential backoff | -- |
| NFR-04-012 | Reliability | Rate limit handling | Retry with backoff on 429 | SECURITY-15 |
| NFR-04-013 | Reliability | Pipeline timeout | 10 minutes max | SECURITY-15 |
| NFR-04-014 | Reliability | Exponential backoff | 1s, 2s, 4s delays | -- |
| NFR-04-015 | Scalability | In-memory SSE | Map-based, document Redis path | -- |
| NFR-04-016 | Scalability | One pipeline per task | 409 on duplicate | -- |
| NFR-04-017 | Maintainability | Prompts in files | /lib/prompts/ directory | -- |
| NFR-04-018 | Maintainability | Structured logging | JSON, taskId correlation, token usage | SECURITY-03 |
