"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { VisualizationNodePhase, PipelineNodeState } from "@/types/pipeline-ui";

interface PipelineTimerProps {
  phase: VisualizationNodePhase;
  state: PipelineNodeState;
}

/** Active timer: MM:SS with leading zeros */
function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Completed timer: Xs for <60s, M:SS for >=60s */
function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function PipelineTimer({ phase, state }: PipelineTimerProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (state.status !== "active" || !state.startedAt) {
      setElapsed(0);
      return;
    }

    // Immediately set current elapsed
    setElapsed(Date.now() - state.startedAt);

    const interval = setInterval(() => {
      setElapsed(Date.now() - state.startedAt!);
    }, 1000);

    return () => clearInterval(interval);
  }, [state.status, state.startedAt]);

  if (state.status === "pending") return null;

  if (state.status === "active" && state.startedAt) {
    return (
      <span
        className="text-[10px] tabular-nums text-muted-foreground"
        data-testid={`pipeline-timer-${phase}-active`}
      >
        {formatElapsed(elapsed)}
      </span>
    );
  }

  if (state.status === "completed" && state.duration !== undefined) {
    return (
      <span
        className="text-[10px] tabular-nums text-muted-foreground"
        data-testid={`pipeline-timer-${phase}-completed`}
      >
        {formatDuration(state.duration)}
      </span>
    );
  }

  if (state.status === "failed" && state.duration !== undefined) {
    return (
      <span
        className={cn("text-[10px] tabular-nums text-red-500")}
        data-testid={`pipeline-timer-${phase}-failed`}
      >
        {formatDuration(state.duration)}
      </span>
    );
  }

  return null;
}
