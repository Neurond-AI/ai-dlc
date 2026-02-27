# Tech Stack Decisions -- UOW-04: AI Pipeline Engine

## Overview

Technology decisions specific to UOW-04. UOW-01 tech stack (Next.js 15, Prisma 6, PostgreSQL, Zustand, Zod) remains the foundation. This document covers the single new dependency and its integration patterns.

---

## New Dependencies

| Technology | Version | Purpose | Rationale |
|-----------|---------|---------|-----------|
| @anthropic-ai/sdk | latest (pinned at install) | AI agent calls with streaming | Official TypeScript SDK. First-class streaming support via `stream()` method. Type-safe message construction. Built-in error types for 429/500 handling. |

---

## Decision Rationale

### @anthropic-ai/sdk over alternatives

**Decision**: Direct Anthropic SDK for all AI agent calls.

**Rationale**:
- Official SDK maintained by Anthropic -- guaranteed API compatibility
- TypeScript-first with full type definitions for messages, streaming events, and errors
- Native streaming via `client.messages.stream()` returns async iterable -- maps directly to SSE
- Built-in error classes (`RateLimitError`, `AuthenticationError`) for typed error handling
- Minimal abstraction -- direct control over model parameters, system prompts, token limits
- No intermediate framework overhead

**Alternatives considered**:

| Alternative | Why rejected |
|-------------|-------------|
| OpenAI SDK | User specification requires Anthropic models. Different API shape would require adapter layer. |
| Vercel AI SDK (`ai`) | Adds abstraction layer over Anthropic SDK. Unnecessary indirection for single-provider use case. Harder to debug streaming issues. Less control over retry logic and error handling. |
| LangChain | Massive dependency tree (~50+ packages). Overkill for sequential agent pipeline. Abstractions add latency and complexity. Debugging difficulty. |
| Direct HTTP (`fetch`) | No typed responses, manual SSE parsing, manual error classification, reimplements what SDK provides. |

---

## Anthropic SDK Integration Patterns

### Model Selection

| Model | Use Case | Rationale |
|-------|----------|-----------|
| `claude-sonnet-4-20250514` | All pipeline agents (primary) | Best speed/cost/quality balance. Fast enough for streaming UX. Sufficient quality for brainstorm, spec, design, review phases. |
| `claude-haiku-3-20250110` | Future: lightweight validation tasks | Faster and cheaper for simple validation/classification. Not used in initial MVP. |

**Decision**: Single model (`claude-sonnet-4-20250514`) for all agents in MVP. Simplifies configuration and token budget management. Per-agent model selection can be added later via prompt config files.

### Token Limits Per Agent

| Agent Phase | Max Input Tokens | Max Output Tokens | Rationale |
|------------|-----------------|------------------|-----------|
| Planner | ~4K (system + task context) | 4,096 | Subtask decomposition requires structured JSON output |
| Coder | ~10K (system + subtask + task context + previous outputs) | 8,192 | Code generation requires largest output window |
| Reviewer | ~12K (system + all file changes + task + subtask list) | 4,096 | Review feedback with findings, scoring, and pass/fail |

**Total estimated per pipeline**: ~26K input tokens, ~16K output tokens per iteration. Up to 3 iterations (max ~48K output tokens total).

**Budget enforcement**: Each agent call sets `max_tokens` parameter. If output truncated, phase marked as "truncated" in pipeline state (not a failure).

### Streaming API Usage Pattern

```typescript
// Pattern: Anthropic SDK streaming with SSE forwarding
import Anthropic from "@anthropic-ai/sdk";

// Client instantiated per-request with user's API key (never stored)
const client = new Anthropic({ apiKey: userApiKey });

const stream = client.messages.stream({
  model: "claude-sonnet-4-20250514",
  max_tokens: 4096,
  system: systemPrompt,
  messages: [{ role: "user", content: userPrompt }],
});

// Forward stream events to SSE
for await (const event of stream) {
  if (event.type === "content_block_delta") {
    const delta = event.delta;
    if (delta.type === "text_delta") {
      sseService.push(taskId, {
        type: "agent-log",
        data: { agent: currentAgent, chunk: delta.text, timestamp: Date.now() }
      });
      accumulator += delta.text;
    }
  }
}

// Collect final message for storage
const finalMessage = await stream.finalMessage();
```

### Error Handling Patterns

```typescript
import Anthropic from "@anthropic-ai/sdk";

// Typed error handling using SDK error classes
try {
  const stream = client.messages.stream({ ... });
  // process stream
} catch (error) {
  if (error instanceof Anthropic.AuthenticationError) {
    // 401: Invalid API key
    // Return 401 to client, terminate pipeline
    return { error: "Invalid API key", status: 401 };
  }
  if (error instanceof Anthropic.RateLimitError) {
    // 429: Rate limited
    // Retry with exponential backoff (1s, 2s, 4s)
    // Respect Retry-After header if present
    const retryAfter = error.headers?.["retry-after"];
    return { retry: true, delay: retryAfter ?? nextBackoff() };
  }
  if (error instanceof Anthropic.APIError) {
    // 500, 503: Server error
    // Retry with backoff, max 3 attempts
    return { retry: true, delay: nextBackoff() };
  }
  // Unknown error: log, mark phase as failed, notify client
  logger.error({
    correlationId: taskId,
    phase: currentPhase,
    error: error.message,  // Never log full error object (may contain key)
  });
  return { error: "Pipeline error", status: 500 };
}
```

### API Key Handling Pattern

```typescript
// Extract from request header -- never store
export async function POST(req: Request) {
  const apiKey = req.headers.get("x-anthropic-key");

  // Validate presence and format
  if (!apiKey || !apiKey.startsWith("sk-ant-")) {
    return Response.json(
      { error: "Valid Anthropic API key required" },
      { status: 400 }
    );
  }

  // Pass directly to SDK client -- key lives only in memory
  const client = new Anthropic({ apiKey });

  // After pipeline completes, client is garbage collected
  // Key is never written to DB, logs, or files
}
```

---

## SSE Implementation Pattern

### Server-Side (Next.js Route Handler)

```typescript
// app/api/sse/[taskId]/route.ts
export async function GET(req: Request) {
  // Verify auth + ownership (NFR-04-008)
  // ...

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // Register connection with SSEService
  sseService.register(taskId, writer);

  // Keepalive interval (NFR-04-004)
  const keepalive = setInterval(() => {
    writer.write(encoder.encode(": keepalive\n\n"));
  }, 30_000);

  // Cleanup on disconnect
  req.signal.addEventListener("abort", () => {
    clearInterval(keepalive);
    sseService.unregister(taskId, writer);
    writer.close();
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
```

### Client-Side (EventSource with Reconnect)

```typescript
// NFR-04-011: Auto-reconnect with exponential backoff
function connectSSE(taskId: string, maxRetries = 3) {
  let retryCount = 0;
  const backoffDelays = [1000, 2000, 4000]; // NFR-04-014

  function connect() {
    const source = new EventSource(`/api/sse/${taskId}`);

    source.onmessage = (event) => {
      retryCount = 0; // Reset on successful message
      const data = JSON.parse(event.data);
      // Dispatch to pipelineStore/taskStore based on event type
    };

    source.onerror = () => {
      source.close();
      if (retryCount < maxRetries) {
        const delay = backoffDelays[retryCount];
        retryCount++;
        setTimeout(connect, delay);
      } else {
        // Show error UI with manual retry button
      }
    };

    return source;
  }

  return connect();
}
```

---

## SSE Event Schema

All SSE events follow a typed schema for client parsing.

| Event Type | Payload | When |
|-----------|---------|------|
| `agent-log` | `{ agent, chunk, timestamp }` | Each streamed token from agent |
| `phase-change` | `{ phase, status, iteration, timestamp }` | Pipeline transitions between phases |
| `task-status` | `{ taskId, newStatus, timestamp }` | Task column moves (spec, building, review, done, backlog) |
| `error` | `{ type, message, retryable, retryCount, maxRetries, timestamp }` | Pipeline encounters retryable/fatal error |
| `pipeline-complete` | `{ taskId, result, fileChanges?, reviewFindings?, timestamp }` | Pipeline reaches COMPLETED or FAILED terminal state |

---

## Agent Isolation Pattern

Each agent (Planner, Coder, Reviewer) is isolated in its own module with a consistent interface:

```typescript
// lib/agents/base-agent.ts (pattern, not a literal base class)
interface AgentExecuteParams {
  apiKey: string;
  taskId: string;
  onChunk: (chunk: string) => void; // SSE push callback
}

interface AgentResult<T> {
  output: T;       // Zod-validated structured output
  tokenUsage: { input: number; output: number };
  durationMs: number;
}
```

**Isolation guarantees**:
- Each agent creates its own Anthropic client instance (no shared state)
- Agent prompt files are separate from agent logic (`lib/prompts/` vs `lib/agents/`)
- Agent output parsed and validated independently via Zod before pipeline proceeds
- Agent failure is contained -- orchestrator catches and handles without affecting other agents

---

## Error Recovery Patterns

### Exponential Backoff Implementation

```typescript
// lib/utils/retry.ts
async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries: number; baseDelay: number }
): Promise<T> {
  const { maxRetries, baseDelay } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;

      const delay = baseDelay * Math.pow(2, attempt); // 1s, 2s, 4s
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("Unreachable");
}
```

### Pipeline State Recovery

On server restart, pipeline state is recovered from DB:
1. Query `PipelineRun` records with `status = "running"`
2. Mark as `"paused"` (cannot safely resume mid-agent-call)
3. Client SSE reconnects, receives current state from DB
4. User can retry (resumes from last completed phase) or cancel

---

## Version Pinning

| Package | Pinned Version | Notes |
|---------|---------------|-------|
| @anthropic-ai/sdk | x.x.x | Pin to latest stable at UOW-04 implementation start. Update only at UOW boundaries or for security patches. |

### Compatibility

| Dependency | Requires | Notes |
|-----------|----------|-------|
| @anthropic-ai/sdk | Node 18+ | Compatible with Next.js 15 runtime. ESM and CJS dual-published. |
| @anthropic-ai/sdk | fetch API | Uses native `fetch` (Node 18+). No polyfill needed. |

---

## Infrastructure Impact

### Environment Variables

No new server-side environment variables. API key provided per-request by client (NFR-04-005).

**Client-side storage**: User's Anthropic API key stored in browser `localStorage` under AES-GCM encryption. This is client-side only -- server never persists.

### Database Impact

No new tables. PipelineRun model (defined in UOW-01 Prisma schema) stores:
- `phase` (enum): current pipeline phase
- `status` (enum): running, paused, passed, failed, cancelled, timed_out
- `iteration` (int): current fix iteration (0-2)
- `agentLogs` (JSON): per-agent streaming output
- `fileChanges` (JSON): accumulated code changes from Coder agent
- `reviewFindings` (JSON): Reviewer agent output

### Network

- Outbound HTTPS to `api.anthropic.com` (Anthropic API)
- Long-lived SSE connections from client to server (one per active pipeline view)
- No new inbound ports or services
