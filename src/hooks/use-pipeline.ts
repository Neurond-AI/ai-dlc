"use client";

import { useState, useCallback } from "react";
import { usePipelineStore } from "@/stores/pipeline-store";
import { getStoredApiKey } from "@/lib/crypto";
import { useAuthStore } from "@/stores/auth-store";
import type { PipelineRunState } from "@/types/pipeline";
import type { AgentLogsStateV2 } from "@/types/agent-log-ui";

export interface UsePipelineOptions {
  taskId: string;
}

export interface UsePipelineReturn {
  // State
  pipelineRun: PipelineRunState | null;
  agentLogs: AgentLogsStateV2 | null;
  isRunning: boolean;
  isPaused: boolean;
  isCompleted: boolean;

  // Actions
  startPipeline: () => Promise<void>;
  cancelPipeline: () => Promise<void>;
  retryPipeline: () => Promise<void>;
  approvePipeline: () => Promise<void>;
  requestChanges: (feedback: string) => Promise<void>;

  // Loading states
  isStarting: boolean;
  isCancelling: boolean;
  isRetrying: boolean;
  isApproving: boolean;
  isRequestingChanges: boolean;

  // Error
  actionError: string | null;
  clearActionError: () => void;
}

export function usePipeline({ taskId }: UsePipelineOptions): UsePipelineReturn {
  const store = usePipelineStore();
  const { user } = useAuthStore();

  const [isStarting, setIsStarting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRequestingChanges, setIsRequestingChanges] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const pipelineRun = store.getPipelineRun(taskId);
  const agentLogs = store.getAgentLogs(taskId);

  const isRunning = pipelineRun?.status === "running";
  const isPaused = pipelineRun?.status === "paused";
  const isCompleted =
    pipelineRun?.status === "passed" ||
    pipelineRun?.status === "failed" ||
    pipelineRun?.status === "cancelled";

  const getApiKeyOrError = useCallback(async (): Promise<string | null> => {
    if (!user?.id) {
      setActionError("Not authenticated");
      return null;
    }
    const apiKey = await getStoredApiKey(user.id);
    if (!apiKey) {
      setActionError("API key required. Configure your Anthropic API key in Settings.");
      return null;
    }
    return apiKey;
  }, [user?.id]);

  const startPipeline = useCallback(async () => {
    const apiKey = await getApiKeyOrError();
    if (!apiKey) return;

    setIsStarting(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/tasks/${taskId}/start-pipeline`, {
        method: "POST",
        headers: { "x-anthropic-key": apiKey },
      });

      const body = await res.json().catch(() => ({})) as { runId?: string; error?: string };

      if (!res.ok) {
        setActionError(body.error ?? "Failed to start pipeline");
        return;
      }

      if (body.runId) {
        store.initPipeline(taskId, body.runId);
      }
    } catch {
      setActionError("Network error starting pipeline");
    } finally {
      setIsStarting(false);
    }
  }, [taskId, getApiKeyOrError, store]);

  const cancelPipeline = useCallback(async () => {
    setIsCancelling(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/pipeline/${taskId}/cancel`, {
        method: "POST",
      });

      const body = await res.json().catch(() => ({})) as { error?: string };

      if (!res.ok) {
        setActionError(body.error ?? "Failed to cancel pipeline");
        return;
      }

      store.cancelPipeline(taskId);
    } catch {
      setActionError("Network error cancelling pipeline");
    } finally {
      setIsCancelling(false);
    }
  }, [taskId, store]);

  const retryPipeline = useCallback(async () => {
    const apiKey = await getApiKeyOrError();
    if (!apiKey) return;

    setIsRetrying(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/pipeline/${taskId}/retry`, {
        method: "POST",
        headers: { "x-anthropic-key": apiKey },
      });

      const body = await res.json().catch(() => ({})) as { runId?: string; error?: string };

      if (!res.ok) {
        setActionError(body.error ?? "Failed to retry pipeline");
        return;
      }

      store.retryPipeline(taskId);

      if (body.runId) {
        store.initPipeline(taskId, body.runId);
      }
    } catch {
      setActionError("Network error retrying pipeline");
    } finally {
      setIsRetrying(false);
    }
  }, [taskId, getApiKeyOrError, store]);

  const approvePipeline = useCallback(async () => {
    setIsApproving(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/pipeline/${taskId}/approve`, {
        method: "POST",
      });

      const body = await res.json().catch(() => ({})) as { error?: string };

      if (!res.ok) {
        setActionError(body.error ?? "Failed to approve pipeline");
      }
    } catch {
      setActionError("Network error approving pipeline");
    } finally {
      setIsApproving(false);
    }
  }, [taskId]);

  const requestChanges = useCallback(
    async (feedback: string) => {
      const apiKey = await getApiKeyOrError();
      if (!apiKey) return;

      setIsRequestingChanges(true);
      setActionError(null);

      try {
        const res = await fetch(`/api/pipeline/${taskId}/request-changes`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-anthropic-key": apiKey,
          },
          body: JSON.stringify({ feedback }),
        });

        const body = await res.json().catch(() => ({})) as { runId?: string; error?: string };

        if (!res.ok) {
          setActionError(body.error ?? "Failed to request changes");
          return;
        }

        if (body.runId) {
          store.initPipeline(taskId, body.runId);
        }
      } catch {
        setActionError("Network error requesting changes");
      } finally {
        setIsRequestingChanges(false);
      }
    },
    [taskId, getApiKeyOrError, store]
  );

  const clearActionError = useCallback(() => {
    setActionError(null);
  }, []);

  return {
    pipelineRun,
    agentLogs,
    isRunning,
    isPaused,
    isCompleted,
    startPipeline,
    cancelPipeline,
    retryPipeline,
    approvePipeline,
    requestChanges,
    isStarting,
    isCancelling,
    isRetrying,
    isApproving,
    isRequestingChanges,
    actionError,
    clearActionError,
  };
}
