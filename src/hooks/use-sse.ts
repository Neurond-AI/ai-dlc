"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { usePipelineStore } from "@/stores/pipeline-store";
import { useTaskStore } from "@/stores/task-store";
import type { SSEEvent } from "@/types/sse";

const MAX_RECONNECT_ATTEMPTS = 3;
const BACKOFF_DELAYS = [1000, 2000, 4000]; // ms

export interface UseSSEOptions {
  taskId: string | null;
  enabled?: boolean;
}

export interface UseSSEReturn {
  isConnected: boolean;
  error: string | null;
  reconnect: () => void;
}

export function useSSE({ taskId, enabled = true }: UseSSEOptions): UseSSEReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { updatePhase, appendLog, setError: setPipelineError, setComplete } =
    usePipelineStore();
  const { updateTaskStatus } = useTaskStore();

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
  }, []);

  // Use refs for functions that need stable identity but read latest values
  const scheduleReconnectRef = useRef<() => void>(() => {});
  const connectRef = useRef<() => void>(() => {});

  // Build connect function
  const connectFn = useCallback(() => {
    if (!taskId || !enabled) return;

    cleanup();

    const url = `/api/pipeline/sse?taskId=${encodeURIComponent(taskId)}`;
    const source = new EventSource(url, { withCredentials: true });
    eventSourceRef.current = source;

    source.onopen = () => {
      setIsConnected(true);
      setError(null);
      reconnectAttemptsRef.current = 0;
    };

    const dispatchSSEEvent = (rawType: string, eventData: unknown) => {
      // Reset reconnect counter on any received event
      reconnectAttemptsRef.current = 0;

      try {
        const sseEvent = { type: rawType, data: eventData } as SSEEvent;

        switch (sseEvent.type) {
          case "agent-log":
            appendLog(
              taskId,
              sseEvent.data.agent,
              sseEvent.data.chunk,
              sseEvent.data.timestamp
            );
            break;

          case "phase-change":
            updatePhase(
              taskId,
              sseEvent.data.phase,
              sseEvent.data.status,
              sseEvent.data.iteration
            );
            break;

          case "task-status":
            updateTaskStatus(sseEvent.data.taskId, sseEvent.data.newStatus);
            break;

          case "error":
            if (sseEvent.data.errorDetails) {
              setPipelineError(taskId, sseEvent.data.errorDetails);
            }
            break;

          case "pipeline-complete":
            setComplete(
              taskId,
              sseEvent.data.result,
              sseEvent.data.fileChanges,
              sseEvent.data.reviewFindings
            );
            break;

          case "timeout":
            // Server closed — attempt reconnect
            scheduleReconnectRef.current();
            break;

          default:
            break;
        }
      } catch {
        // Ignore dispatch errors
      }
    };

    // Listen to each named event type
    const eventTypes: SSEEvent["type"][] = [
      "agent-log",
      "phase-change",
      "task-status",
      "error",
      "pipeline-complete",
      "timeout",
      "heartbeat",
    ];

    for (const eventType of eventTypes) {
      source.addEventListener(eventType, (event: Event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data) as unknown;
          dispatchSSEEvent(eventType, data);
        } catch {
          // ignore parse errors
        }
      });
    }

    // Fallback: onmessage for events without explicit type
    source.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as { type?: string };
        if (parsed.type) {
          dispatchSSEEvent(parsed.type, parsed);
        }
      } catch {
        // ignore
      }
    };

    source.onerror = () => {
      setIsConnected(false);
      scheduleReconnectRef.current();
    };
  }, [taskId, enabled, cleanup, appendLog, updatePhase, updateTaskStatus, setPipelineError, setComplete]);

  const scheduleReconnectFn = useCallback(() => {
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      setError(`SSE connection failed after ${MAX_RECONNECT_ATTEMPTS} attempts`);
      return;
    }

    const delay = BACKOFF_DELAYS[reconnectAttemptsRef.current] ?? 4000;
    reconnectAttemptsRef.current++;

    reconnectTimerRef.current = setTimeout(() => {
      connectRef.current();
    }, delay);
  }, []);

  // Keep refs in sync
  connectRef.current = connectFn;
  scheduleReconnectRef.current = scheduleReconnectFn;

  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    setError(null);
    connectRef.current();
  }, []);

  useEffect(() => {
    if (taskId && enabled) {
      connectFn();
    } else {
      cleanup();
    }

    return cleanup;
  }, [taskId, enabled, connectFn, cleanup]);

  return { isConnected, error, reconnect };
}
