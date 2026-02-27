"use client";

import React, { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { toast } from "sonner";
import { useTaskStore } from "@/stores/task-store";
import { KANBAN_COLUMNS, type TaskStatus } from "@/types/task";
import { KanbanColumn } from "./kanban-column";
import { TaskCard } from "@/components/task/task-card";

export function KanbanBoard() {
  const { tasks, moveTask } = useTaskStore();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) ?? null : null;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
    document.body.classList.add("is-dragging");
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const overId = event.over?.id;
    setOverId(overId ? String(overId) : null);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      document.body.classList.remove("is-dragging");
      setActiveId(null);
      setOverId(null);

      if (!over) return;

      const taskId = String(active.id);
      const targetColumnId = String(over.id) as TaskStatus;

      // Validate it's a known column
      const validStatuses = KANBAN_COLUMNS.map((c) => c.status) as string[];
      if (!validStatuses.includes(targetColumnId)) return;

      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      // Same column: no-op
      if (task.status === targetColumnId) return;

      // BR-03-007: active pipeline drag restriction
      if (
        task.pipelineState?.isActive &&
        targetColumnId !== "backlog"
      ) {
        toast.error(
          "Cannot move task with an active pipeline. Drag to Backlog to cancel."
        );
        return;
      }

      const previousStatus = task.status;
      const newStatus = targetColumnId as TaskStatus;

      // Optimistic update
      moveTask(taskId, newStatus);

      try {
        const res = await fetch(`/api/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });
        if (!res.ok) throw new Error("Failed to move task");
      } catch {
        // Rollback
        moveTask(taskId, previousStatus);
        toast.error("Failed to move task. Reverted.");
      }
    },
    [tasks, moveTask]
  );

  const handleDragCancel = useCallback(() => {
    document.body.classList.remove("is-dragging");
    setActiveId(null);
    setOverId(null);
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div
        className="flex gap-4 overflow-x-auto pb-4"
        data-testid="kanban-board"
        aria-label="Kanban board"
      >
        {KANBAN_COLUMNS.map((col) => (
          <KanbanColumn
            key={col.status}
            status={col.status}
            label={col.label}
            emptyText={col.emptyText}
            isOver={overId === col.status}
          />
        ))}
      </div>

      <DragOverlay
        dropAnimation={{ duration: 200, easing: "ease-out" }}
      >
        {activeTask ? (
          <TaskCard task={activeTask} isDragOverlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
