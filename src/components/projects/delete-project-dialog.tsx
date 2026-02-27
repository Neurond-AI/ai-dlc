"use client";

import React, { useState, useEffect } from "react";
import { useProjectStore } from "@/stores/project-store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Project } from "@/types/project";

interface DeleteProjectDialogProps {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteProjectDialog({
  project,
  open,
  onOpenChange,
}: DeleteProjectDialogProps) {
  const { deleteProject, isLoading, error, clearError } = useProjectStore();
  const [confirmation, setConfirmation] = useState("");

  useEffect(() => {
    if (open) {
      setConfirmation("");
      clearError();
    }
  }, [open, clearError]);

  const isConfirmed = confirmation === project.name;

  const handleDelete = async () => {
    const ok = await deleteProject(project.id);
    if (ok) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="delete-project-dialog">
        <DialogHeader>
          <DialogTitle>Delete Project</DialogTitle>
          <DialogDescription>
            This action is permanent and will delete all tasks and pipeline runs
            in this project.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
            All tasks and pipeline run history in &quot;{project.name}&quot; will be
            permanently deleted.
          </div>

          <div className="space-y-2">
            <Label htmlFor="delete-confirmation">
              Type{" "}
              <span className="font-mono font-semibold">{project.name}</span> to
              confirm
            </Label>
            <Input
              id="delete-confirmation"
              type="text"
              placeholder={project.name}
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              data-testid="delete-project-confirmation-input"
            />
          </div>

          {error && (
            <p
              className="text-sm text-destructive"
              role="alert"
              data-testid="delete-project-error"
            >
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="mt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="delete-project-cancel"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={!isConfirmed}
            loading={isLoading}
            data-testid="delete-project-confirm"
          >
            Delete project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
