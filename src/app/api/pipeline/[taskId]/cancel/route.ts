import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { cancelPipeline } from "@/lib/services/pipeline-orchestrator";

// POST /api/pipeline/[taskId]/cancel
export async function POST(
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

  // Find active pipeline run (BR-04-014)
  const run = await db.pipelineRun.findFirst({
    where: {
      taskId,
      status: { in: ["running", "paused"] },
    },
    orderBy: { startedAt: "desc" },
  });

  if (!run) {
    return NextResponse.json(
      { error: "No active pipeline to cancel" },
      { status: 400 }
    );
  }

  await cancelPipeline(taskId, run.id);

  return NextResponse.json({ status: "cancelled" });
}
