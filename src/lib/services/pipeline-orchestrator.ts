import { db } from "@/lib/db";
import { type Prisma } from "@prisma/client";
import { sseService } from "./sse-service";
import { runPlannerAgent, PlannerOutputError } from "./planner-agent";
import { runCoderAgent, runCoderFixAgent, CoderOutputError } from "./coder-agent";
import { runReviewerAgent, ReviewerOutputError } from "./reviewer-agent";
import type { SubtaskList, FileChanges, ReviewResult, ErrorDetails } from "@/types/agent";
import type { PipelinePhase, PipelineStatus } from "@/types/pipeline";
import type { SSEEvent } from "@/types/sse";
import Anthropic from "@anthropic-ai/sdk";

const MAX_FIX_ITERATIONS = 3;

// Helper to convert typed objects to Prisma-compatible JSON input
function toJson(value: unknown): Prisma.InputJsonValue {
  // Round-trip through JSON to get a plain object compatible with Prisma's JSON field type
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

// -- Active pipeline abort controllers (in-memory, per process) --

const activeAbortControllers = new Map<string, AbortController>();

// -- Orchestrator Entry Point --

/**
 * Execute the full pipeline for a task. Non-blocking — call without await.
 */
export async function executePipeline(
  taskId: string,
  pipelineRunId: string,
  apiKey: string
): Promise<void> {
  const abortController = new AbortController();
  activeAbortControllers.set(pipelineRunId, abortController);

  try {
    await runPipeline(taskId, pipelineRunId, apiKey, abortController.signal);
  } catch (err) {
    // Top-level catch: mark as failed if not already terminal
    const message =
      err instanceof Error ? err.message : "Unknown pipeline error";

    if (abortController.signal.aborted) {
      // Cancellation already handled inside runPipeline
      return;
    }

    await safeUpdateRun(pipelineRunId, {
      phase: "failed",
      status: "failed",
      completedAt: new Date(),
      errorDetails: {
        type: "unknown",
        message,
        retryCount: 0,
        maxRetries: 3,
        timestamp: Date.now(),
      },
    });

    pushEvent(taskId, {
      type: "pipeline-complete",
      data: { taskId, result: "failed", timestamp: Date.now() },
    });
  } finally {
    activeAbortControllers.delete(pipelineRunId);
  }
}

/**
 * Cancel a running pipeline by pipelineRunId.
 */
export async function cancelPipeline(
  taskId: string,
  pipelineRunId: string
): Promise<void> {
  const controller = activeAbortControllers.get(pipelineRunId);
  if (controller) {
    controller.abort();
  }

  await safeUpdateRun(pipelineRunId, {
    phase: "cancelled",
    status: "cancelled",
    completedAt: new Date(),
  });

  await db.task.update({
    where: { id: taskId },
    data: { status: "backlog" },
  });

  pushEvent(taskId, {
    type: "phase-change",
    data: {
      phase: "cancelled",
      status: "cancelled",
      iteration: 0,
      timestamp: Date.now(),
    },
  });

  pushEvent(taskId, {
    type: "task-status",
    data: { taskId, newStatus: "backlog", timestamp: Date.now() },
  });
}

// -- Core Pipeline State Machine --

async function runPipeline(
  taskId: string,
  pipelineRunId: string,
  apiKey: string,
  abortSignal: AbortSignal
): Promise<void> {
  // Load pipeline run
  const run = await db.pipelineRun.findUniqueOrThrow({
    where: { id: pipelineRunId },
    include: { task: true },
  });

  const task = run.task;
  let subtaskList: SubtaskList | null = null;
  let fileChanges: FileChanges = { files: [] };
  let reviewResult: ReviewResult | null = null;
  let iteration = 0;

  // --- PHASE: PLANNING ---
  await transitionPhase(pipelineRunId, taskId, "planning", "running", 0);

  const plannerLog: string[] = [];
  const onPlannerLog = (chunk: string) => {
    plannerLog.push(chunk);
    pushEvent(taskId, {
      type: "agent-log",
      data: { agent: "planner", chunk, timestamp: Date.now() },
    });
  };

  try {
    subtaskList = await runPlannerAgent({
      apiKey,
      taskTitle: task.title,
      taskDescription: task.description,
      taskCategory: task.category,
      onLog: onPlannerLog,
      abortSignal,
    });
  } catch (err) {
    await handleAgentError(err, pipelineRunId, taskId, "planner", "planning");
    return;
  }

  // Store subtasks on task record
  await db.task.update({
    where: { id: taskId },
    data: { subtasks: toJson(subtaskList) },
  });

  // Update agent logs
  await db.pipelineRun.update({
    where: { id: pipelineRunId },
    data: {
      agentLogs: {
        planner: plannerLog,
        coder: [],
        reviewer: [],
      },
    },
  });

  checkAbort(abortSignal);

  // --- PHASE: CODING ---
  await transitionPhase(pipelineRunId, taskId, "coding", "running", 0);

  // Move task to "building"
  await db.task.update({ where: { id: taskId }, data: { status: "building" } });
  pushEvent(taskId, {
    type: "task-status",
    data: { taskId, newStatus: "building", timestamp: Date.now() },
  });

  const coderLog: string[] = [];
  const onCoderLog = (chunk: string) => {
    coderLog.push(chunk);
    pushEvent(taskId, {
      type: "agent-log",
      data: { agent: "coder", chunk, timestamp: Date.now() },
    });
  };

  try {
    fileChanges = await runCoderAgent({
      apiKey,
      taskTitle: task.title,
      taskDescription: task.description,
      taskCategory: task.category,
      subtasks: subtaskList.subtasks,
      onLog: onCoderLog,
      abortSignal,
    });
  } catch (err) {
    await handleAgentError(err, pipelineRunId, taskId, "coder", "coding");
    return;
  }

  await db.pipelineRun.update({
    where: { id: pipelineRunId },
    data: {
      fileChanges: toJson(fileChanges),
      agentLogs: {
        planner: plannerLog,
        coder: coderLog,
        reviewer: [],
      },
    },
  });

  checkAbort(abortSignal);

  // --- REVIEW LOOP ---
  const reviewerLog: string[] = [];

  while (iteration <= MAX_FIX_ITERATIONS) {
    // --- PHASE: REVIEWING ---
    await transitionPhase(pipelineRunId, taskId, "reviewing", "running", iteration);

    const onReviewerLog = (chunk: string) => {
      reviewerLog.push(chunk);
      pushEvent(taskId, {
        type: "agent-log",
        data: { agent: "reviewer", chunk, timestamp: Date.now() },
      });
    };

    try {
      reviewResult = await runReviewerAgent({
        apiKey,
        taskTitle: task.title,
        taskDescription: task.description,
        taskCategory: task.category,
        subtasks: subtaskList.subtasks,
        fileChanges,
        onLog: onReviewerLog,
        abortSignal,
      });
    } catch (err) {
      await handleAgentError(err, pipelineRunId, taskId, "reviewer", "reviewing");
      return;
    }

    await db.pipelineRun.update({
      where: { id: pipelineRunId },
      data: {
        reviewFindings: toJson(reviewResult),
        agentLogs: {
          planner: plannerLog,
          coder: coderLog,
          reviewer: reviewerLog,
        },
      },
    });

    checkAbort(abortSignal);

    // --- Evaluate review result ---
    if (reviewResult.passed) {
      // COMPLETED
      await safeUpdateRun(pipelineRunId, {
        phase: "completed",
        status: "passed",
        completedAt: new Date(),
        fileChanges: toJson(fileChanges),
        reviewFindings: toJson(reviewResult),
        agentLogs: {
          planner: plannerLog,
          coder: coderLog,
          reviewer: reviewerLog,
        },
      });

      await db.task.update({ where: { id: taskId }, data: { status: "review" } });

      pushEvent(taskId, {
        type: "task-status",
        data: { taskId, newStatus: "review", timestamp: Date.now() },
      });

      pushEvent(taskId, {
        type: "pipeline-complete",
        data: {
          taskId,
          result: "passed",
          fileChanges,
          reviewFindings: reviewResult,
          timestamp: Date.now(),
        },
      });

      return;
    }

    // Review failed
    if (iteration >= MAX_FIX_ITERATIONS - 1) {
      // FAILED — max iterations exhausted
      await safeUpdateRun(pipelineRunId, {
        phase: "failed",
        status: "failed",
        completedAt: new Date(),
        fileChanges: toJson(fileChanges),
        reviewFindings: toJson(reviewResult),
        agentLogs: {
          planner: plannerLog,
          coder: coderLog,
          reviewer: reviewerLog,
        },
      });

      await db.task.update({ where: { id: taskId }, data: { status: "backlog" } });

      pushEvent(taskId, {
        type: "task-status",
        data: { taskId, newStatus: "backlog", timestamp: Date.now() },
      });

      pushEvent(taskId, {
        type: "pipeline-complete",
        data: {
          taskId,
          result: "failed",
          reviewFindings: reviewResult,
          timestamp: Date.now(),
        },
      });

      return;
    }

    // --- PHASE: FIXING ---
    iteration++;

    await db.pipelineRun.update({
      where: { id: pipelineRunId },
      data: { iteration },
    });

    await transitionPhase(pipelineRunId, taskId, "fixing", "running", iteration);

    const fixMsg = `\n\nReview failed (score: ${reviewResult.score}/100) — auto-fixing (attempt ${iteration}/${MAX_FIX_ITERATIONS - 1})\n`;
    coderLog.push(fixMsg);
    pushEvent(taskId, {
      type: "agent-log",
      data: { agent: "coder", chunk: fixMsg, timestamp: Date.now() },
    });

    const onFixLog = (chunk: string) => {
      coderLog.push(chunk);
      pushEvent(taskId, {
        type: "agent-log",
        data: { agent: "coder", chunk, timestamp: Date.now() },
      });
    };

    try {
      fileChanges = await runCoderFixAgent({
        apiKey,
        taskTitle: task.title,
        taskDescription: task.description,
        subtasks: subtaskList.subtasks,
        currentCode: fileChanges,
        reviewFindings: reviewResult.findings,
        iteration,
        onLog: onFixLog,
        abortSignal,
      });
    } catch (err) {
      await handleAgentError(err, pipelineRunId, taskId, "coder", "fixing");
      return;
    }

    await db.pipelineRun.update({
      where: { id: pipelineRunId },
      data: {
        fileChanges: toJson(fileChanges),
        agentLogs: {
          planner: plannerLog,
          coder: coderLog,
          reviewer: reviewerLog,
        },
      },
    });

    checkAbort(abortSignal);
    // Loop back to REVIEWING
  }
}

// -- Helpers --

async function transitionPhase(
  pipelineRunId: string,
  taskId: string,
  phase: PipelinePhase,
  status: PipelineStatus,
  iteration: number
): Promise<void> {
  await db.pipelineRun.update({
    where: { id: pipelineRunId },
    data: { phase, status, iteration },
  });

  pushEvent(taskId, {
    type: "phase-change",
    data: { phase, status, iteration, timestamp: Date.now() },
  });
}

async function handleAgentError(
  err: unknown,
  pipelineRunId: string,
  taskId: string,
  failedAgent: "planner" | "coder" | "reviewer",
  failedPhase: "planning" | "coding" | "reviewing" | "fixing"
): Promise<void> {
  const message =
    err instanceof Error ? err.message : "Unknown agent error";

  let statusCode: number | undefined;
  let errorType: ErrorDetails["type"] = "unknown";

  if (err instanceof Anthropic.AuthenticationError) {
    statusCode = 401;
    errorType = "api_error";
  } else if (err instanceof Anthropic.RateLimitError) {
    statusCode = 429;
    errorType = "api_error";
  } else if (err instanceof Anthropic.APIError) {
    statusCode = (err as { status?: number }).status;
    errorType = "api_error";
  } else if (
    err instanceof PlannerOutputError ||
    err instanceof CoderOutputError ||
    err instanceof ReviewerOutputError
  ) {
    errorType = "parse_error";
  }

  const errorDetails: ErrorDetails = {
    type: errorType,
    message,
    statusCode,
    failedAgent,
    failedPhase,
    retryCount: 0,
    maxRetries: 3,
    timestamp: Date.now(),
  };

  await safeUpdateRun(pipelineRunId, {
    status: "paused",
    errorDetails: toJson(errorDetails),
  });

  pushEvent(taskId, {
    type: "error",
    data: {
      type: errorType,
      message,
      retryable: true,
      retryCount: 0,
      maxRetries: 3,
      errorDetails,
      timestamp: Date.now(),
    },
  });
}

async function safeUpdateRun(
  pipelineRunId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>
): Promise<void> {
  try {
    await db.pipelineRun.update({
      where: { id: pipelineRunId },
      data,
    });
  } catch {
    // Ignore DB errors during cleanup
  }
}

function pushEvent(taskId: string, event: SSEEvent): void {
  try {
    sseService.push(taskId, event);
  } catch {
    // Ignore SSE push errors
  }
}

function checkAbort(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new Error("Pipeline cancelled");
  }
}
