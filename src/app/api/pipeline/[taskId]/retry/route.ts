import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { executePipeline } from "@/lib/services/pipeline-orchestrator";
import { getBackoffDelay } from "@/lib/services/retry";
import type { ErrorDetails } from "@/types/agent";

// POST /api/pipeline/[taskId]/retry
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { taskId } = await params;

  // Validate API key header
  const apiKey = req.headers.get("x-anthropic-key");
  if (!apiKey || apiKey.trim() === "") {
    return NextResponse.json(
      { error: "API key required. Provide x-anthropic-key header." },
      { status: 401 }
    );
  }

  // Verify task ownership
  const task = await db.task.findUnique({ where: { id: taskId } });
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const project = await db.project.findFirst({
    where: { id: task.projectId, userId: session.user.id },
  });
  if (!project) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  // Find paused pipeline run
  const run = await db.pipelineRun.findFirst({
    where: { taskId, status: "paused" },
    orderBy: { startedAt: "desc" },
  });

  if (!run) {
    return NextResponse.json(
      { error: "No paused pipeline to retry" },
      { status: 400 }
    );
  }

  const errorDetails = run.errorDetails as ErrorDetails | null;
  const retryCount = errorDetails?.retryCount ?? 0;
  const maxRetries = errorDetails?.maxRetries ?? 3;

  if (retryCount >= maxRetries) {
    return NextResponse.json(
      { error: "Maximum retry attempts exhausted" },
      { status: 400 }
    );
  }

  // Calculate backoff delay (BR-04-017)
  const delay = getBackoffDelay(retryCount);

  // Create a fresh pipeline run for retry
  const newRun = await db.pipelineRun.create({
    data: {
      taskId,
      phase: "planning",
      iteration: 0,
      status: "running",
      agentLogs: { planner: [], coder: [], reviewer: [] },
      fileChanges: { files: [] },
      startedAt: new Date(),
    },
  });

  // Mark old run as failed
  await db.pipelineRun.update({
    where: { id: run.id },
    data: { status: "failed", phase: "failed", completedAt: new Date() },
  });

  // Launch after backoff delay
  setTimeout(() => {
    executePipeline(taskId, newRun.id, apiKey).catch(() => {
      // Errors handled inside executePipeline
    });
  }, delay);

  return NextResponse.json({ runId: newRun.id, retryDelay: delay }, { status: 202 });
}
