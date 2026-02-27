import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sseService } from "@/lib/services/sse-service";

// POST /api/pipeline/[taskId]/approve
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

  // Validate task is in review status (BR-04-013)
  if (task.status !== "review") {
    return NextResponse.json(
      { error: "Task must be in Review status to approve" },
      { status: 400 }
    );
  }

  // Move task to "done"
  await db.task.update({ where: { id: taskId }, data: { status: "done" } });

  sseService.push(taskId, {
    type: "task-status",
    data: { taskId, newStatus: "done", timestamp: Date.now() },
  });

  return NextResponse.json({ status: "approved" });
}
