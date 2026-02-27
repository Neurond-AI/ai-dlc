"use client";

import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { AnimatePresence, motion } from "framer-motion";
import { useShallow } from "zustand/react/shallow";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTaskStore } from "@/stores/task-store";
import { type TaskStatus } from "@/types/task";
import { TaskCard } from "@/components/task/task-card";
import { EmptyColumnState } from "./empty-column-state";

interface KanbanColumnProps {
  status: TaskStatus;
  label: string;
  emptyText: string;
  isOver?: boolean;
}

export function KanbanColumn({
  status,
  label,
  emptyText,
  isOver,
}: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({ id: status });

  // Derive filtered tasks directly from state snapshot for correct reactivity
  const tasks = useTaskStore(
    useShallow((s) => {
      const { tasks: allTasks, filter } = s;
      return allTasks
        .filter((t) => {
          if (t.status !== status) return false;
          if (filter.category && t.category !== filter.category) return false;
          if (filter.priority && t.priority !== filter.priority) return false;
          if (filter.search) {
            const q = filter.search.toLowerCase();
            if (
              !t.title.toLowerCase().includes(q) &&
              !(t.description ?? "").toLowerCase().includes(q)
            ) {
              return false;
            }
          }
          return true;
        })
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
    })
  );

  const taskIds = tasks.map((t) => t.id);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-w-[240px] flex-1 flex-col rounded-lg border bg-muted/20 transition-colors",
        isOver && "ring-2 ring-primary/20 bg-primary/5"
      )}
      data-testid={`kanban-column-${status}`}
      aria-label={`Drop zone: ${label}`}
    >
      {/* Column Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-lg border-b bg-muted/30 px-3 py-2 backdrop-blur-sm">
        <span className="text-sm font-semibold" data-testid={`column-label-${status}`}>
          {label}
        </span>
        <Badge
          variant="secondary"
          className="text-xs"
          data-testid={`column-count-${status}`}
        >
          {tasks.length}
        </Badge>
      </div>

      {/* Task List */}
      <ScrollArea className="flex-1">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2 p-2" data-testid={`column-tasks-${status}`}>
            <AnimatePresence mode="popLayout">
              {tasks.map((task) => (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                >
                  <TaskCard task={task} />
                </motion.div>
              ))}
            </AnimatePresence>

            {tasks.length === 0 && (
              <EmptyColumnState text={emptyText} />
            )}
          </div>
        </SortableContext>
      </ScrollArea>
    </div>
  );
}
