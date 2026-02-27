import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sseService } from "@/lib/services/sse-service";

const SSE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes (BR-04-015)

// GET /api/pipeline/sse?taskId=xxx
export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const taskId = req.nextUrl.searchParams.get("taskId");
  if (!taskId) {
    return new Response(JSON.stringify({ error: "taskId query parameter required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Verify task ownership
  const task = await db.task.findUnique({ where: { id: taskId } });
  if (!task) {
    return new Response(JSON.stringify({ error: "Task not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const project = await db.project.findFirst({
    where: { id: task.projectId, userId: session.user.id },
  });
  if (!project) {
    return new Response(JSON.stringify({ error: "Task not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Create SSE stream
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // Register with SSE service
  sseService.register(taskId, writer);

  // Send initial connected event
  const connectedPayload = encoder.encode(
    `event: connected\ndata: ${JSON.stringify({ taskId, timestamp: Date.now() })}\n\n`
  );
  writer.write(connectedPayload).catch(() => {
    sseService.unregister(taskId, writer);
  });

  // 10-minute connection timeout (BR-04-015)
  const timeoutTimer = setTimeout(() => {
    const timeoutPayload = encoder.encode(
      `event: timeout\ndata: ${JSON.stringify({
        message: "Connection timed out. Reconnect if pipeline is still running.",
      })}\n\n`
    );
    writer
      .write(timeoutPayload)
      .then(() => {
        sseService.unregister(taskId, writer);
        writer.close();
      })
      .catch(() => {
        sseService.unregister(taskId, writer);
      });
  }, SSE_TIMEOUT_MS);

  // Cleanup on client disconnect
  req.signal.addEventListener("abort", () => {
    clearTimeout(timeoutTimer);
    sseService.unregister(taskId, writer);
    writer.close().catch(() => {
      // ignore
    });
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
