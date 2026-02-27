"use client";

import { useMemo } from "react";
import { usePipelineStore } from "@/stores/pipeline-store";
import { PIPELINE_NODES } from "@/lib/constants/pipeline-nodes";
import type {
  PipelineNodeConfig,
  PipelineNodeState,
  NodeStatus,
  UsePipelineVisualizationReturn,
} from "@/types/pipeline-ui";
import type { PipelineRunState } from "@/types/pipeline";

interface UsePipelineVisualizationOptions {
  taskId: string;
}

export function usePipelineVisualization(
  { taskId }: UsePipelineVisualizationOptions
): UsePipelineVisualizationReturn {
  const pipelineRun = usePipelineStore((s) => s.pipelineRuns.get(taskId));
  const phaseTimings = usePipelineStore((s) => s.phaseTimings.get(taskId));

  const nodes: PipelineNodeState[] = useMemo(() => {
    return PIPELINE_NODES.map((config) => {
      const timing = phaseTimings?.[config.phase];
      const status = deriveNodeStatus(config, pipelineRun);

      return {
        phase: config.phase,
        status,
        startedAt: timing?.startedAt,
        completedAt: timing?.completedAt,
        duration: timing?.duration,
      };
    });
  }, [pipelineRun, phaseTimings]);

  return {
    nodes,
    isActive: pipelineRun?.status === "running",
    iteration: pipelineRun?.iteration ?? 0,
  };
}

function deriveNodeStatus(
  config: PipelineNodeConfig,
  pipelineRun: PipelineRunState | undefined
): NodeStatus {
  if (!pipelineRun) return "pending";

  const currentPhase = pipelineRun.phase;
  const nodeIndex = PIPELINE_NODES.findIndex((n) => n.phase === config.phase);
  const activeIndex = PIPELINE_NODES.findIndex((n) =>
    n.serverPhases.includes(currentPhase)
  );

  // "plan" node has no direct server phase — completes when active moves past it
  if (config.phase === "plan") {
    // activeIndex >= 2 means code or beyond is active (past planning)
    if (activeIndex >= 2) return "completed";
    // If planning is active (index 0), plan node is still pending
    return "pending";
  }

  // Terminal states
  if (pipelineRun.status === "failed" || currentPhase === "failed") {
    if (nodeIndex === activeIndex) return "failed";
    if (nodeIndex < activeIndex) return "completed";
    return "pending";
  }

  if (pipelineRun.status === "cancelled" || currentPhase === "cancelled") {
    return "pending";
  }

  // Completed pipeline: all nodes are completed
  if (pipelineRun.status === "passed" || currentPhase === "completed") {
    return "completed";
  }

  // No active node found (phase not mapped to a visualization node)
  if (activeIndex === -1) return "pending";

  // Normal flow
  if (nodeIndex < activeIndex) return "completed";
  if (nodeIndex === activeIndex) return "active";
  return "pending";
}
