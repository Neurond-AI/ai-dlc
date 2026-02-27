"use client";

import { useEffect } from "react";
import { useTaskStore } from "@/stores/task-store";
import { useProjectStore } from "@/stores/project-store";
import { KanbanBoard } from "@/components/board/kanban-board";
import { KanbanBoardSkeleton } from "@/components/board/kanban-board-skeleton";
import { EmptyBoardState } from "@/components/board/empty-board-state";
import { TaskFilterBar } from "@/components/board/task-filter-bar";
import { TaskCreationModal } from "@/components/task/task-creation-modal";

export default function BoardPage() {
  const tasks = useTaskStore((s) => s.tasks);
  const isLoading = useTaskStore((s) => s.isLoading);
  const fetchTasks = useTaskStore((s) => s.fetchTasks);
  const reset = useTaskStore((s) => s.reset);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);

  useEffect(() => {
    if (activeProjectId) {
      fetchTasks(activeProjectId);
    } else {
      reset();
    }
  }, [activeProjectId, fetchTasks, reset]);

  return (
    <div
      className="flex flex-1 flex-col overflow-hidden p-4"
      data-testid="board-page"
    >
      <TaskFilterBar />

      {isLoading ? (
        <KanbanBoardSkeleton />
      ) : tasks.length === 0 ? (
        <EmptyBoardState />
      ) : (
        <KanbanBoard />
      )}

      <TaskCreationModal />
    </div>
  );
}
