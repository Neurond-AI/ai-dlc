import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createProjectSchema } from "@/lib/validators/project";
import { headers } from "next/headers";

const PROJECT_LIMIT = 20;

async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projects = await db.project.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, userId: true, createdAt: true, updatedAt: true },
  });

  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { name } = parsed.data;
  const userId = session.user.id;

  const count = await db.project.count({ where: { userId } });
  if (count >= PROJECT_LIMIT) {
    return NextResponse.json(
      { error: `You can have at most ${PROJECT_LIMIT} projects` },
      { status: 422 }
    );
  }

  const existing = await db.project.findFirst({
    where: { userId, name: { equals: name, mode: "insensitive" } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "A project with this name already exists" },
      { status: 409 }
    );
  }

  const project = await db.project.create({
    data: { name: name.trim(), userId },
    select: { id: true, name: true, userId: true, createdAt: true, updatedAt: true },
  });

  return NextResponse.json(project, { status: 201 });
}
