import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { AgentLogs } from "@/types/agent";

// GET /api/pipeline/[taskId]/status
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { taskId } = await params;

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

  // Fetch latest pipeline run (ordered by startedAt DESC)
  const run = await db.pipelineRun.findFirst({
    where: { taskId },
    orderBy: { startedAt: "desc" },
  });

  if (!run) {
    return NextResponse.json({ status: "none" });
  }

  const agentLogs = run.agentLogs as AgentLogs | null;
  const logSummary = {
    plannerEntries: agentLogs?.planner?.length ?? 0,
    coderEntries: agentLogs?.coder?.length ?? 0,
    reviewerEntries: agentLogs?.reviewer?.length ?? 0,
  };

  const reviewFindings = run.reviewFindings as {
    score?: number;
  } | null;

  return NextResponse.json({
    runId: run.id,
    phase: run.phase,
    iteration: run.iteration,
    status: run.status,
    agentLogSummary: logSummary,
    hasFileChanges:
      (run.fileChanges as { files?: unknown[] } | null)?.files?.length !== 0,
    reviewScore: reviewFindings?.score ?? null,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    errorDetails: run.errorDetails,
  });
}
