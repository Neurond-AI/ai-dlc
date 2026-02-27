import type { SSEEvent } from "@/types/sse";

const HEARTBEAT_INTERVAL_MS = 30_000;

type SSEWriter = WritableStreamDefaultWriter<Uint8Array>;

// -- SSE Service Singleton --

class SSEService {
  private connections: Map<string, Set<SSEWriter>> = new Map();
  private heartbeatTimers: Map<SSEWriter, ReturnType<typeof setInterval>> =
    new Map();
  private encoder = new TextEncoder();

  /**
   * Register a new SSE writer for a task.
   * Starts a 30s keepalive heartbeat automatically.
   */
  register(taskId: string, writer: SSEWriter): void {
    if (!this.connections.has(taskId)) {
      this.connections.set(taskId, new Set());
    }
    this.connections.get(taskId)!.add(writer);

    // Start heartbeat
    const timer = setInterval(() => {
      this.sendRaw(writer, ": keepalive\n\n").catch(() => {
        this.unregister(taskId, writer);
      });
    }, HEARTBEAT_INTERVAL_MS);

    this.heartbeatTimers.set(writer, timer);
  }

  /**
   * Unregister an SSE writer, clearing its heartbeat timer.
   */
  unregister(taskId: string, writer: SSEWriter): void {
    const timer = this.heartbeatTimers.get(writer);
    if (timer) {
      clearInterval(timer);
      this.heartbeatTimers.delete(writer);
    }

    const writers = this.connections.get(taskId);
    if (writers) {
      writers.delete(writer);
      if (writers.size === 0) {
        this.connections.delete(taskId);
      }
    }
  }

  /**
   * Push a typed SSE event to all connections for a task.
   */
  push(taskId: string, event: SSEEvent): void {
    const writers = this.connections.get(taskId);
    if (!writers || writers.size === 0) return;

    const payload = formatSSEEvent(event);

    for (const writer of Array.from(writers)) {
      this.sendRaw(writer, payload).catch(() => {
        this.unregister(taskId, writer);
      });
    }
  }

  /**
   * Close all connections for a task.
   */
  closeAll(taskId: string): void {
    const writers = this.connections.get(taskId);
    if (!writers) return;

    for (const writer of Array.from(writers)) {
      const timer = this.heartbeatTimers.get(writer);
      if (timer) {
        clearInterval(timer);
        this.heartbeatTimers.delete(writer);
      }
      writer.close().catch(() => {
        // ignore close errors
      });
    }

    this.connections.delete(taskId);
  }

  /**
   * Get the number of active connections for a task.
   */
  connectionCount(taskId: string): number {
    return this.connections.get(taskId)?.size ?? 0;
  }

  private async sendRaw(writer: SSEWriter, data: string): Promise<void> {
    await writer.write(this.encoder.encode(data));
  }
}

// -- Wire Format Helper --

function formatSSEEvent(event: SSEEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
}

// -- Global Singleton --

const globalForSSE = globalThis as unknown as {
  sseService: SSEService | undefined;
};

export const sseService =
  globalForSSE.sseService ?? new SSEService();

if (process.env.NODE_ENV !== "production") {
  globalForSSE.sseService = sseService;
}
