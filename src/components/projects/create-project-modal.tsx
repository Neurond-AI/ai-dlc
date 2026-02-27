"use client";

import React, { useState, useEffect } from "react";
import { useProjectStore } from "@/stores/project-store";
import { createProjectSchema } from "@/lib/validators/project";
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

interface CreateProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateProjectModal({ open, onOpenChange }: CreateProjectModalProps) {
  const { createProject, isLoading, error, clearError } = useProjectStore();
  const [name, setName] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setName("");
      setFieldError(null);
      clearError();
    }
  }, [open, clearError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError(null);
    clearError();

    const parsed = createProjectSchema.safeParse({ name });
    if (!parsed.success) {
      setFieldError(parsed.error.errors[0]?.message ?? "Invalid name");
      return;
    }

    const result = await createProject(parsed.data.name);
    if (result) {
      onOpenChange(false);
    }
  };

  const displayError = fieldError ?? error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="create-project-modal">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
          <DialogDescription>
            Give your project a unique name (1–50 characters).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-2">
            <Label htmlFor="project-name">Project name</Label>
            <Input
              id="project-name"
              type="text"
              placeholder="My Project"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              maxLength={50}
              data-testid="create-project-name-input"
              aria-describedby={displayError ? "create-project-error" : undefined}
            />
            {displayError && (
              <p
                id="create-project-error"
                className="text-sm text-destructive"
                role="alert"
                data-testid="create-project-error"
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
              data-testid="create-project-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={isLoading}
              disabled={!name.trim()}
              data-testid="create-project-submit"
            >
              Create project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
