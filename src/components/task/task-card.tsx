"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { CheckSquare, MoreVertical, Trash2, Clock, Eye } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useTaskStore } from "@/stores/task-store";
import { type Task, PHASE_COLORS } from "@/types/task";
import { PhaseIndicator } from "./phase-indicator";
import { PulseDot } from "./pulse-dot";
import { CategoryBadge } from "./category-badge";

interface TaskCardProps {
  task: Task;
  isDragOverlay?: boolean;
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function formatAbsoluteTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TaskCard({ task, isDragOverlay = false }: TaskCardProps) {
  const router = useRouter();
  const deleteTask = useTaskStore((s) => s.deleteTask);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const phaseColor = PHASE_COLORS[task.pipelineState?.phase ?? "idle"];
  const isActive = task.pipelineState?.isActive ?? false;
  const isInReview = task.status === "review";
  const isDone = task.status === "done";

  const completedSubtasks =
    task.subtasks?.filter((s) => s.status === "completed").length ?? 0;
  const totalSubtasks = task.subtasks?.length ?? 0;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // Don't navigate if clicking dropdown or if dragging
      if (isDragging || isDragOverlay) return;
      const target = e.target as HTMLElement;
      if (target.closest("[data-task-menu]")) return;
      router.push(`/task/${task.id}`);
    },
    [router, task.id, isDragging, isDragOverlay]
  );

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      await deleteTask(task.id);
      toast.success("Task deleted");
    } catch {
      toast.error("Failed to delete task");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  }, [deleteTask, task.id]);

  return (
    <>
      <motion.div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        whileHover={isDragOverlay ? {} : { y: -2 }}
        whileTap={isDragOverlay ? {} : { scale: 0.98 }}
        layout
        onClick={handleClick}
        className={cn(
          "group relative flex cursor-grab flex-col gap-2 rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing",
          isDragOverlay && "scale-[1.02] shadow-lg cursor-grabbing",
          isDone && "border-emerald-200 dark:border-emerald-800"
        )}
        data-testid="task-card"
        aria-label={`Drag task: ${task.title}`}
      >
        {/* Top row: title + phase indicators */}
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 flex-1 text-sm font-medium leading-snug">
            {task.title}
          </p>
          <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
            {isInReview && (
              <span
                className="flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                data-testid="task-card-review-badge"
                aria-label="Awaiting review"
              >
                <Eye className="h-2.5 w-2.5" />
                Review
              </span>
            )}
            <PhaseIndicator phase={task.pipelineState?.phase ?? null} size="sm" />
            <PulseDot isActive={isActive} color={phaseColor} />
            {/* Context menu */}
            <div data-task-menu>
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="flex h-5 w-5 items-center justify-center rounded opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100"
                  data-testid="task-card-menu-trigger"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                  <span className="sr-only">Task actions</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    data-testid="task-card-delete-option"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDeleteDialog(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Bottom row: category, subtasks, timestamp */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CategoryBadge category={task.category} size="sm" />

          {totalSubtasks > 0 && (
            <span
              className="flex items-center gap-0.5"
              data-testid="task-card-subtask-count"
            >
              <CheckSquare className="h-3 w-3" />
              {completedSubtasks}/{totalSubtasks}
            </span>
          )}

          <span className="ml-auto flex items-center gap-0.5">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className="flex items-center gap-0.5 cursor-default"
                    data-testid="task-card-timestamp"
                  >
                    <Clock className="h-3 w-3" />
                    {formatRelativeTime(task.updatedAt)}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{formatAbsoluteTime(task.updatedAt)}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </span>
        </div>
      </motion.div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete task &quot;{task.title}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="task-delete-cancel">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="task-delete-confirm"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
