import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { executePipeline } from "@/lib/services/pipeline-orchestrator";

// POST /api/tasks/[id]/start-pipeline
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: taskId } = await params;

  if (!taskId) {
    return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });
  }

  // Validate API key header (BR-04-004)
  const apiKey = req.headers.get("x-anthropic-key");
  if (!apiKey || apiKey.trim() === "") {
    return NextResponse.json(
      { error: "API key required. Provide x-anthropic-key header." },
      { status: 401 }
    );
  }

  // Load task and verify ownership (Task -> Project -> User)
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

  // Validate task status (BR-04-001)
  if (task.status !== "backlog" && task.status !== "spec") {
    return NextResponse.json(
      {
        error:
          "Pipeline can only start on tasks in Backlog or Spec status",
      },
      { status: 400 }
    );
  }

  // Check for active pipeline run (BR-04-002)
  const activePipeline = await db.pipelineRun.findFirst({
    where: {
      taskId,
      status: { in: ["running", "paused"] },
    },
  });
  if (activePipeline) {
    return NextResponse.json(
      { error: "A pipeline is already running for this task" },
      { status: 409 }
    );
  }

  // Create PipelineRun record
  const pipelineRun = await db.pipelineRun.create({
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

  // Move task to "spec" if currently in "backlog" (BR-04-008)
  if (task.status === "backlog") {
    await db.task.update({ where: { id: taskId }, data: { status: "spec" } });
  }

  // Launch orchestrator asynchronously — does NOT block response
  executePipeline(taskId, pipelineRun.id, apiKey).catch(() => {
    // Errors are handled inside executePipeline
  });

  return NextResponse.json(
    { runId: pipelineRun.id, taskId },
    { status: 202 }
  );
}
