import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createTaskSchema, taskQuerySchema } from "@/lib/validators/task";
import { headers } from "next/headers";

// GET /api/tasks?projectId=...
export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const parsed = taskQuerySchema.safeParse({
    projectId: searchParams.get("projectId"),
    status: searchParams.get("status") ?? undefined,
    category: searchParams.get("category") ?? undefined,
    search: searchParams.get("search") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid query" },
      { status: 400 }
    );
  }

  const { projectId, status, category, search } = parsed.data;

  // Verify project ownership
  const project = await db.project.findFirst({
    where: { id: projectId, userId: session.user.id },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const tasks = await db.task.findMany({
    where: {
      projectId,
      ...(status ? { status } : {}),
      ...(category ? { category } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ tasks });
}

// POST /api/tasks
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Validation failed" },
      { status: 400 }
    );
  }

  const { title, description, category, priority, projectId } = parsed.data;

  // Verify project ownership
  const project = await db.project.findFirst({
    where: { id: projectId, userId: session.user.id },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Enforce 100 tasks/project limit (BR-03-009)
  const taskCount = await db.task.count({ where: { projectId } });
  if (taskCount >= 100) {
    return NextResponse.json(
      {
        error:
          "Project has reached the maximum of 100 tasks. Delete existing tasks to create new ones.",
      },
      { status: 400 }
    );
  }

  const task = await db.task.create({
    data: {
      title,
      description: description || null,
      category,
      priority,
      status: "backlog",
      projectId,
    },
  });

  return NextResponse.json({ task }, { status: 201 });
}
