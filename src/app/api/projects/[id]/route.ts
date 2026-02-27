import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { renameProjectSchema } from "@/lib/validators/project";
import { headers } from "next/headers";

async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

async function getOwnedProject(userId: string, projectId: string) {
  return db.project.findFirst({ where: { id: projectId, userId } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const project = await getOwnedProject(session.user.id, id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = renameProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { name } = parsed.data;

  const existing = await db.project.findFirst({
    where: {
      userId: session.user.id,
      name: { equals: name, mode: "insensitive" },
      NOT: { id },
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: "A project with this name already exists" },
      { status: 409 }
    );
  }

  const updated = await db.project.update({
    where: { id },
    data: { name: name.trim() },
    select: { id: true, name: true, userId: true, createdAt: true, updatedAt: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const project = await getOwnedProject(session.user.id, id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  await db.project.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
