"use client";

import React, { useState, useCallback } from "react";
import { toast } from "sonner";
import { useUIStore } from "@/stores/ui-store";
import { useTaskStore } from "@/stores/task-store";
import { useProjectStore } from "@/stores/project-store";
import { createTaskSchema } from "@/lib/validators/task";
import {
  type TaskCategory,
  type TaskPriority,
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  CATEGORY_LABELS,
  PRIORITY_LABELS,
} from "@/types/task";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FormState {
  title: string;
  description: string;
  category: TaskCategory;
  priority: TaskPriority;
}

interface FormErrors {
  title?: string;
  description?: string;
  category?: string;
  priority?: string;
  form?: string;
}

const INITIAL_FORM: FormState = {
  title: "",
  description: "",
  category: "feature",
  priority: "medium",
};

export function TaskCreationModal() {
  const isOpen = useUIStore((s) => s.isTaskModalOpen);
  const closeTaskModal = useUIStore((s) => s.closeTaskModal);
  const createTask = useTaskStore((s) => s.createTask);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);

  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isCreating, setIsCreating] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        closeTaskModal();
        setForm(INITIAL_FORM);
        setErrors({});
      }
    },
    [closeTaskModal]
  );

  const validate = useCallback((): boolean => {
    const result = createTaskSchema.safeParse({
      ...form,
      projectId: activeProjectId ?? "placeholder",
    });

    if (!result.success) {
      const fieldErrors: FormErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof FormErrors;
        if (field && field !== "form") {
          fieldErrors[field] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return false;
    }

    setErrors({});
    return true;
  }, [form, activeProjectId]);

  const handleCreate = useCallback(async () => {
    if (!validate()) return;
    if (!activeProjectId) {
      setErrors({ form: "No active project selected." });
      return;
    }

    setIsCreating(true);
    try {
      await createTask({
        title: form.title.trim(),
        description: form.description || undefined,
        category: form.category,
        priority: form.priority,
        projectId: activeProjectId,
      });
      toast.success("Task created");
      closeTaskModal();
      setForm(INITIAL_FORM);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.";
      setErrors({ form: msg });
    } finally {
      setIsCreating(false);
    }
  }, [validate, activeProjectId, form, createTask, closeTaskModal]);

  const handleCreateAndStart = useCallback(async () => {
    if (!validate()) return;
    if (!activeProjectId) {
      setErrors({ form: "No active project selected." });
      return;
    }

    // BR-03-008: check for API key
    const apiKey =
      typeof window !== "undefined" ? localStorage.getItem("ac_api_key") : null;

    if (!apiKey) {
      setErrors({
        form: "API key required. Configure your Anthropic API key in Settings to start pipelines.",
      });
      return;
    }

    setIsStarting(true);
    try {
      const task = await createTask({
        title: form.title.trim(),
        description: form.description || undefined,
        category: form.category,
        priority: form.priority,
        projectId: activeProjectId,
      });

      const pipelineRes = await fetch(`/api/tasks/${task.id}/start-pipeline`, {
        method: "POST",
        headers: { "x-anthropic-key": apiKey },
      });

      if (!pipelineRes.ok) {
        const body = await pipelineRes.json().catch(() => ({}));
        if (pipelineRes.status === 401) {
          setErrors({ form: "API key invalid -- please update in Settings" });
          setIsStarting(false);
          return;
        }
        throw new Error(body.error ?? "Failed to start pipeline");
      }

      toast.success("Task created, pipeline starting...");
      closeTaskModal();
      setForm(INITIAL_FORM);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.";
      setErrors({ form: msg });
    } finally {
      setIsStarting(false);
    }
  }, [validate, activeProjectId, form, createTask, closeTaskModal]);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="task-creation-modal">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="task-title"
              placeholder="Enter task title..."
              value={form.title}
              onChange={(e) => {
                setForm((f) => ({ ...f, title: e.target.value }));
                if (errors.title) setErrors((er) => ({ ...er, title: undefined }));
              }}
              maxLength={200}
              data-testid="task-title-input"
            />
            {errors.title && (
              <p
                className="text-xs text-destructive"
                data-testid="task-title-error"
              >
                {errors.title}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-description">Description</Label>
            <Textarea
              id="task-description"
              placeholder="Describe what you want the AI to build..."
              value={form.description}
              onChange={(e) => {
                setForm((f) => ({ ...f, description: e.target.value }));
                if (errors.description)
                  setErrors((er) => ({ ...er, description: undefined }));
              }}
              maxLength={5000}
              className="min-h-[80px] resize-none"
              data-testid="task-description-input"
            />
            <p className="text-right text-xs text-muted-foreground">
              {form.description.length}/5000
            </p>
            {errors.description && (
              <p
                className="text-xs text-destructive"
                data-testid="task-description-error"
              >
                {errors.description}
              </p>
            )}
          </div>

          {/* Category + Priority row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-category">
                Category <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.category}
                onValueChange={(v) => {
                  setForm((f) => ({ ...f, category: v as TaskCategory }));
                  if (errors.category)
                    setErrors((er) => ({ ...er, category: undefined }));
                }}
              >
                <SelectTrigger
                  id="task-category"
                  data-testid="task-category-select"
                >
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {TASK_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {CATEGORY_LABELS[cat]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && (
                <p
                  className="text-xs text-destructive"
                  data-testid="task-category-error"
                >
                  {errors.category}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-priority">
                Priority <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.priority}
                onValueChange={(v) => {
                  setForm((f) => ({ ...f, priority: v as TaskPriority }));
                  if (errors.priority)
                    setErrors((er) => ({ ...er, priority: undefined }));
                }}
              >
                <SelectTrigger
                  id="task-priority"
                  data-testid="task-priority-select"
                >
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.priority && (
                <p
                  className="text-xs text-destructive"
                  data-testid="task-priority-error"
                >
                  {errors.priority}
                </p>
              )}
            </div>
          </div>

          {/* Form-level error */}
          {errors.form && (
            <p
              className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              data-testid="task-form-error"
            >
              {errors.form}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            data-testid="task-modal-cancel"
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={handleCreateAndStart}
            loading={isStarting}
            disabled={isCreating}
            data-testid="task-create-and-start-btn"
          >
            Create &amp; Start
          </Button>
          <Button
            onClick={handleCreate}
            loading={isCreating}
            disabled={isStarting}
            data-testid="task-create-btn"
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
