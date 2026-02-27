import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { executePipeline } from "@/lib/services/pipeline-orchestrator";
import { requestChangesSchema } from "@/lib/validators/pipeline";

// POST /api/pipeline/[taskId]/request-changes
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

  if (task.status !== "review") {
    return NextResponse.json(
      { error: "Task must be in Review status to request changes" },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = requestChangesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Validation failed" },
      { status: 400 }
    );
  }

  // Move task back to "building" and start fresh pipeline
  await db.task.update({ where: { id: taskId }, data: { status: "building" } });

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

  // Note: feedback stored in pipeline description for context via task update
  // The feedback influences the task description used in prompts
  await db.task.update({
    where: { id: taskId },
    data: {
      description: task.description
        ? `${task.description}\n\n## Change Request\n${parsed.data.feedback}`
        : `## Change Request\n${parsed.data.feedback}`,
    },
  });

  executePipeline(taskId, newRun.id, apiKey).catch(() => {
    // Errors handled inside executePipeline
  });

  return NextResponse.json({ runId: newRun.id }, { status: 202 });
}
