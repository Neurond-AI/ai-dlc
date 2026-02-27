"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, CheckSquare, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useTaskStore } from "@/stores/task-store";
import { useUIStore } from "@/stores/ui-store";
import { usePipelineStore } from "@/stores/pipeline-store";
import { useSSE } from "@/hooks/use-sse";
import {
  type Task,
  STATUS_LABELS,
  PRIORITY_LABELS,
} from "@/types/task";
import type { PipelinePhase, PipelineStatus } from "@/types/pipeline";
import { PhaseIndicator } from "./phase-indicator";
import { CategoryBadge } from "./category-badge";
import { PipelineVisualization } from "@/components/pipeline/pipeline-visualization";
import { PipelineControls } from "@/components/pipeline/pipeline-controls";
import { DiffReviewPanel } from "@/components/diff-review/diff-review-panel";
import { ErrorNotification } from "@/components/pipeline/error-notification";

interface TaskDetailViewProps {
  taskId: string;
}

export function TaskDetailView({ taskId }: TaskDetailViewProps) {
  const router = useRouter();
  const tasks = useTaskStore((s) => s.tasks);
  const setActiveLogTaskId = useUIStore((s) => s.setActiveLogTaskId);
  const hydratePipelineRun = usePipelineStore((s) => s.hydratePipelineRun);
  const pipelineStatus = usePipelineStore((s) => s.getPipelineRun(taskId)?.status);

  const [task, setTask] = useState<Task | null>(
    () => tasks.find((t) => t.id === taskId) ?? null
  );
  const [isLoading, setIsLoading] = useState(!task);
  const [error, setError] = useState<string | null>(null);

  // Activate SSE connection for live pipeline updates
  useSSE({ taskId, enabled: true });

  // Set active log task on mount/unmount
  useEffect(() => {
    setActiveLogTaskId(taskId);
    return () => setActiveLogTaskId(null);
  }, [taskId, setActiveLogTaskId]);

  // Hydrate pipeline state from server on mount
  useEffect(() => {
    async function hydratePipeline() {
      try {
        const response = await fetch(`/api/pipeline/${taskId}/status`);
        if (response.ok) {
          const data = await response.json() as {
            status?: string;
            runId?: string;
            phase?: PipelinePhase;
            iteration?: number;
          };
          if (data.status !== "none" && data.runId) {
            hydratePipelineRun(taskId, {
              runId: data.runId,
              phase: data.phase ?? "planning",
              status: (data.status as PipelineStatus) ?? "running",
              iteration: data.iteration ?? 0,
            });
          }
        }
      } catch {
        // Non-critical: SSE will provide live updates
      }
    }
    hydratePipeline();
  }, [taskId, hydratePipelineRun]);

  // Load task data
  useEffect(() => {
    const existing = tasks.find((t) => t.id === taskId);
    if (existing) {
      setTask(existing);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    fetch(`/api/tasks/${taskId}`)
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 404) {
            router.push("/board");
            return;
          }
          throw new Error("Failed to load task details");
        }
        const body = await res.json() as { task: Task };
        if (!cancelled) {
          setTask(body.task);
          setIsLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [taskId, tasks, router]);

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center p-8"
        data-testid="task-detail-loading"
      >
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex flex-col items-center gap-4 p-8"
        data-testid="task-detail-error"
      >
        <p className="text-destructive">{error}</p>
        <Button variant="outline" onClick={() => router.push("/board")}>
          Back to Board
        </Button>
      </div>
    );
  }

  if (!task) return null;

  const phase = task.pipelineState?.phase ?? null;
  const completedSubtasks =
    task.subtasks?.filter((s) => s.status === "completed").length ?? 0;
  const totalSubtasks = task.subtasks?.length ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="mx-auto max-w-3xl px-4 py-6"
      data-testid="task-detail-view"
    >
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/board")}
        className="mb-4 -ml-2"
        data-testid="task-detail-back-btn"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Board
      </Button>

      {/* Header card */}
      <div className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <h1
              className="text-xl font-semibold leading-tight"
              data-testid="task-detail-title"
            >
              {task.title}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <CategoryBadge category={task.category} size="md" />
              <Badge variant="secondary" data-testid="task-detail-status">
                {STATUS_LABELS[task.status]}
              </Badge>
              {task.pipelineState?.phase && (
                <div className="flex items-center gap-1.5">
                  <PhaseIndicator phase={phase} size="sm" />
                  <span className="text-xs text-muted-foreground">
                    {task.pipelineState.phase}
                  </span>
                </div>
              )}
            </div>
          </div>

          <Badge
            variant="outline"
            className="flex-shrink-0"
            data-testid="task-detail-priority"
          >
            {PRIORITY_LABELS[task.priority]}
          </Badge>
        </div>
      </div>

      {/* Pipeline Visualization */}
      <div
        className="mt-4 rounded-lg border bg-card"
        data-testid="pipeline-visualization-container"
      >
        <PipelineVisualization taskId={taskId} />
      </div>

      {/* Pipeline Controls */}
      <div className="mt-3">
        <PipelineControls taskId={taskId} taskStatus={task.status} />
      </div>

      {/* Description */}
      {task.description && (
        <>
          <Separator className="my-4" />
          <div data-testid="task-detail-description">
            <h2 className="mb-2 text-sm font-semibold">Description</h2>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {task.description}
            </p>
          </div>
        </>
      )}

      {/* Subtasks */}
      {task.subtasks && task.subtasks.length > 0 && (
        <>
          <Separator className="my-4" />
          <div data-testid="task-detail-subtasks">
            <h2 className="mb-2 text-sm font-semibold">
              Subtasks ({completedSubtasks}/{totalSubtasks})
            </h2>
            <ul className="flex flex-col gap-1.5">
              {task.subtasks
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((subtask) => (
                  <li
                    key={subtask.id}
                    className="flex items-start gap-2 text-sm"
                    data-testid={`subtask-${subtask.id}`}
                  >
                    {subtask.status === "completed" ? (
                      <CheckSquare className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                    ) : (
                      <Circle className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    )}
                    <span
                      className={
                        subtask.status === "completed"
                          ? "text-muted-foreground line-through"
                          : ""
                      }
                    >
                      {subtask.title}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        </>
      )}

      {/* Error Notification (BR-06-010) */}
      {pipelineStatus === "paused" && (
        <div className="mt-4">
          <ErrorNotification taskId={taskId} />
        </div>
      )}

      {/* Diff Review Panel (UOW-06) */}
      <DiffReviewPanel taskId={taskId} />

      {/* Timestamps */}
      <Separator className="my-4" />
      <div
        className="flex gap-4 text-xs text-muted-foreground"
        data-testid="task-detail-timestamps"
      >
        <span>
          Created:{" "}
          {new Date(task.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
        <span>
          Updated:{" "}
          {new Date(task.updatedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </div>
    </motion.div>
  );
}
