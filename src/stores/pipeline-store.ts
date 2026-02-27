"use client";

import { create } from "zustand";
import type { PipelinePhase, PipelineStatus, PipelineRunState } from "@/types/pipeline";
import type { AgentType, ErrorDetails, FileChanges, ReviewResult } from "@/types/agent";
import type { PhaseTimingsMap, VisualizationNodePhase } from "@/types/pipeline-ui";
import type { LogEntry, AgentLogsStateV2 } from "@/types/agent-log-ui";
import { PIPELINE_NODES, LOG_ENTRY_GROUP_THRESHOLD_MS } from "@/lib/constants/pipeline-nodes";

// -- State --

interface PipelineStoreState {
  pipelineRuns: Map<string, PipelineRunState>;
  agentLogs: Map<string, AgentLogsStateV2>;
  phaseTimings: Map<string, PhaseTimingsMap>;
  isStarting: boolean;
  activePipelineTaskId: string | null;
}

// -- Actions --

interface PipelineStoreActions {
  // Lifecycle actions
  initPipeline: (taskId: string, runId: string) => void;
  updatePhase: (
    taskId: string,
    phase: PipelinePhase,
    status: PipelineStatus,
    iteration: number
  ) => void;
  appendLog: (
    taskId: string,
    agent: AgentType,
    chunk: string,
    timestamp: number
  ) => void;
  setError: (taskId: string, errorDetails: ErrorDetails) => void;
  setComplete: (
    taskId: string,
    result: "passed" | "failed",
    fileChanges?: FileChanges,
    reviewFindings?: ReviewResult
  ) => void;
  retryPipeline: (taskId: string) => void;
  cancelPipeline: (taskId: string) => void;
  clearLogs: (taskId: string) => void;
  removePipeline: (taskId: string) => void;
  hydratePipelineRun: (taskId: string, data: Partial<PipelineRunState> & { runId: string }) => void;

  // UI state
  setIsStarting: (value: boolean) => void;
  setActivePipelineTaskId: (taskId: string | null) => void;

  // Selectors
  getPipelineRun: (taskId: string) => PipelineRunState | null;
  getAgentLogs: (taskId: string) => AgentLogsStateV2 | null;
  getPhaseTimings: (taskId: string) => PhaseTimingsMap | null;
  hasAnyActivePipeline: () => boolean;
}

type PipelineStore = PipelineStoreState & PipelineStoreActions;

// -- Default Values --

function createEmptyLogsState(): AgentLogsStateV2 {
  return { planner: [], coder: [], reviewer: [] };
}

/** Map server phase to visualization node phase */
function getVisualizationPhase(serverPhase: PipelinePhase): VisualizationNodePhase | null {
  for (const node of PIPELINE_NODES) {
    if (node.serverPhases.includes(serverPhase)) {
      return node.phase;
    }
  }
  return null;
}

// -- Store Definition --

export const usePipelineStore = create<PipelineStore>((set, get) => ({
  pipelineRuns: new Map(),
  agentLogs: new Map(),
  phaseTimings: new Map(),
  isStarting: false,
  activePipelineTaskId: null,

  initPipeline: (taskId: string, runId: string) => {
    const now = Date.now();
    set((state) => {
      const runs = new Map(state.pipelineRuns);
      const logs = new Map(state.agentLogs);
      const timings = new Map(state.phaseTimings);

      runs.set(taskId, {
        runId,
        phase: "planning",
        status: "running",
        iteration: 0,
        startedAt: now,
        completedAt: null,
        errorDetails: null,
        fileChanges: null,
        reviewFindings: null,
      });

      logs.set(taskId, createEmptyLogsState());
      timings.set(taskId, {
        spec: { startedAt: now },
      });

      return {
        pipelineRuns: runs,
        agentLogs: logs,
        phaseTimings: timings,
        activePipelineTaskId: taskId,
      };
    });
  },

  updatePhase: (
    taskId: string,
    phase: PipelinePhase,
    status: PipelineStatus,
    iteration: number
  ) => {
    const now = Date.now();
    set((state) => {
      const runs = new Map(state.pipelineRuns);
      const timings = new Map(state.phaseTimings);

      const existing = runs.get(taskId);
      if (existing) {
        runs.set(taskId, { ...existing, phase, status, iteration });
      }

      // Update phase timings
      const taskTimings: PhaseTimingsMap = { ...(timings.get(taskId) ?? {}) };
      const prevPhase = existing?.phase;

      // Mark previous visualization phase as completed
      if (prevPhase) {
        const prevVisPhase = getVisualizationPhase(prevPhase);
        if (prevVisPhase && taskTimings[prevVisPhase]) {
          const prevTiming = taskTimings[prevVisPhase]!;
          if (!prevTiming.completedAt) {
            taskTimings[prevVisPhase] = {
              ...prevTiming,
              completedAt: now,
              duration: now - prevTiming.startedAt,
            };
          }
        }
      }

      // Start new visualization phase timing
      const newVisPhase = getVisualizationPhase(phase);
      if (newVisPhase && !taskTimings[newVisPhase]) {
        taskTimings[newVisPhase] = { startedAt: now };
      }

      // Handle completion: mark done node
      if (phase === "completed") {
        if (!taskTimings.done) {
          taskTimings.done = { startedAt: now, completedAt: now, duration: 0 };
        }
      }

      timings.set(taskId, taskTimings);

      return { pipelineRuns: runs, phaseTimings: timings };
    });
  },

  appendLog: (
    taskId: string,
    agent: AgentType,
    chunk: string,
    timestamp: number
  ) => {
    set((state) => {
      const logs = new Map(state.agentLogs);
      const existing = logs.get(taskId) ?? createEmptyLogsState();
      const agentLogs = existing[agent];
      const lastEntry = agentLogs[agentLogs.length - 1];

      let updatedAgentLogs: LogEntry[];

      // Group chunks within threshold window
      if (
        lastEntry &&
        lastEntry.isStreaming &&
        timestamp - lastEntry.timestamp < LOG_ENTRY_GROUP_THRESHOLD_MS
      ) {
        // Append to existing entry
        updatedAgentLogs = [
          ...agentLogs.slice(0, -1),
          {
            ...lastEntry,
            content: lastEntry.content + chunk,
            timestamp,
          },
        ];
      } else {
        // New entry
        const newEntry: LogEntry = {
          id: crypto.randomUUID(),
          agentType: agent,
          content: chunk,
          timestamp,
          isStreaming: true,
        };
        // Mark previous entry as done streaming
        const prevEntries = lastEntry
          ? [...agentLogs.slice(0, -1), { ...lastEntry, isStreaming: false }]
          : agentLogs;
        updatedAgentLogs = [...prevEntries, newEntry];
      }

      const updated: AgentLogsStateV2 = {
        ...existing,
        [agent]: updatedAgentLogs,
      };
      logs.set(taskId, updated);
      return { agentLogs: logs };
    });
  },

  setError: (taskId: string, errorDetails: ErrorDetails) => {
    set((state) => {
      const runs = new Map(state.pipelineRuns);
      const existing = runs.get(taskId);
      if (existing) {
        runs.set(taskId, { ...existing, status: "paused", errorDetails });
      }
      return { pipelineRuns: runs };
    });
  },

  setComplete: (
    taskId: string,
    result: "passed" | "failed",
    fileChanges?: FileChanges,
    reviewFindings?: ReviewResult
  ) => {
    const now = Date.now();
    set((state) => {
      const runs = new Map(state.pipelineRuns);
      const timings = new Map(state.phaseTimings);

      const existing = runs.get(taskId);
      if (existing) {
        const status: PipelineStatus = result === "passed" ? "passed" : "failed";
        runs.set(taskId, {
          ...existing,
          status,
          phase: result === "passed" ? "completed" : "failed",
          completedAt: now,
          fileChanges: fileChanges ?? existing.fileChanges,
          reviewFindings: reviewFindings ?? existing.reviewFindings,
        });
      }

      // Mark current phase timing as completed
      const taskTimings: PhaseTimingsMap = { ...(timings.get(taskId) ?? {}) };
      const currentPhase = existing?.phase;
      if (currentPhase) {
        const visPhase = getVisualizationPhase(currentPhase);
        if (visPhase && taskTimings[visPhase] && !taskTimings[visPhase]!.completedAt) {
          const t = taskTimings[visPhase]!;
          taskTimings[visPhase] = {
            ...t,
            completedAt: now,
            duration: now - t.startedAt,
          };
        }
      }
      timings.set(taskId, taskTimings);

      return { pipelineRuns: runs, phaseTimings: timings };
    });
  },

  retryPipeline: (taskId: string) => {
    set((state) => {
      const runs = new Map(state.pipelineRuns);
      const existing = runs.get(taskId);
      if (existing) {
        runs.set(taskId, {
          ...existing,
          status: "running",
          errorDetails: null,
        });
      }
      return { pipelineRuns: runs };
    });
  },

  cancelPipeline: (taskId: string) => {
    set((state) => {
      const runs = new Map(state.pipelineRuns);
      const existing = runs.get(taskId);
      if (existing) {
        runs.set(taskId, {
          ...existing,
          status: "cancelled",
          phase: "cancelled",
          completedAt: Date.now(),
        });
      }
      return { pipelineRuns: runs, activePipelineTaskId: null };
    });
  },

  clearLogs: (taskId: string) => {
    set((state) => {
      const logs = new Map(state.agentLogs);
      logs.set(taskId, createEmptyLogsState());
      return { agentLogs: logs };
    });
  },

  removePipeline: (taskId: string) => {
    set((state) => {
      const runs = new Map(state.pipelineRuns);
      const logs = new Map(state.agentLogs);
      const timings = new Map(state.phaseTimings);
      runs.delete(taskId);
      logs.delete(taskId);
      timings.delete(taskId);
      return { pipelineRuns: runs, agentLogs: logs, phaseTimings: timings };
    });
  },

  hydratePipelineRun: (taskId, data) => {
    const now = Date.now();
    set((state) => {
      const runs = new Map(state.pipelineRuns);
      const existing = runs.get(taskId);
      runs.set(taskId, {
        runId: data.runId,
        phase: data.phase ?? "planning",
        status: data.status ?? "running",
        iteration: data.iteration ?? 0,
        startedAt: data.startedAt ?? now,
        completedAt: data.completedAt ?? null,
        errorDetails: data.errorDetails ?? null,
        fileChanges: data.fileChanges ?? existing?.fileChanges ?? null,
        reviewFindings: data.reviewFindings ?? existing?.reviewFindings ?? null,
      });
      return { pipelineRuns: runs };
    });
  },

  setIsStarting: (value: boolean) => {
    set({ isStarting: value });
  },

  setActivePipelineTaskId: (taskId: string | null) => {
    set({ activePipelineTaskId: taskId });
  },

  getPipelineRun: (taskId: string) => {
    return get().pipelineRuns.get(taskId) ?? null;
  },

  getAgentLogs: (taskId: string) => {
    return get().agentLogs.get(taskId) ?? null;
  },

  getPhaseTimings: (taskId: string) => {
    return get().phaseTimings.get(taskId) ?? null;
  },

  hasAnyActivePipeline: () => {
    return Array.from(get().pipelineRuns.values()).some(
      (run) => run.status === "running"
    );
  },
}));
