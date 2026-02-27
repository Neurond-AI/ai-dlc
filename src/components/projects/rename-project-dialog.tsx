"use client";

import React, { useState, useEffect } from "react";
import { useProjectStore } from "@/stores/project-store";
import { renameProjectSchema } from "@/lib/validators/project";
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

interface RenameProjectDialogProps {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RenameProjectDialog({
  project,
  open,
  onOpenChange,
}: RenameProjectDialogProps) {
  const { renameProject, isLoading, error, clearError } = useProjectStore();
  const [name, setName] = useState(project.name);
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(project.name);
      setFieldError(null);
      clearError();
    }
  }, [open, project.name, clearError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError(null);
    clearError();

    const parsed = renameProjectSchema.safeParse({ name });
    if (!parsed.success) {
      setFieldError(parsed.error.errors[0]?.message ?? "Invalid name");
      return;
    }

    if (parsed.data.name.toLowerCase() === project.name.toLowerCase()) {
      onOpenChange(false);
      return;
    }

    const ok = await renameProject(project.id, parsed.data.name);
    if (ok) {
      onOpenChange(false);
    }
  };

  const displayError = fieldError ?? error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="rename-project-dialog">
        <DialogHeader>
          <DialogTitle>Rename Project</DialogTitle>
          <DialogDescription>
            Enter a new name for &quot;{project.name}&quot;.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-2">
            <Label htmlFor="rename-project-name">New name</Label>
            <Input
              id="rename-project-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              maxLength={50}
              data-testid="rename-project-name-input"
              aria-describedby={displayError ? "rename-project-error" : undefined}
            />
            {displayError && (
              <p
                id="rename-project-error"
                className="text-sm text-destructive"
                role="alert"
                data-testid="rename-project-error"
              >
                {displayError}
              </p>
            )}
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="rename-project-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={isLoading}
              disabled={!name.trim()}
              data-testid="rename-project-submit"
            >
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
