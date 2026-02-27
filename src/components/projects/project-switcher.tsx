"use client";

import React, { useState } from "react";
import { Check, ChevronDown, Plus, Pencil, Trash2, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@/stores/project-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { CreateProjectModal } from "@/components/projects/create-project-modal";
import { RenameProjectDialog } from "@/components/projects/rename-project-dialog";
import { DeleteProjectDialog } from "@/components/projects/delete-project-dialog";
import type { Project } from "@/types/project";

interface ProjectSwitcherProps {
  collapsed?: boolean;
}

export function ProjectSwitcher({ collapsed = false }: ProjectSwitcherProps) {
  const { projects, activeProjectId, setActiveProjectId } = useProjectStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [renameProject, setRenameProject] = useState<Project | null>(null);
  const [deleteProject, setDeleteProject] = useState<Project | null>(null);

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-between text-sm font-medium",
              collapsed && "w-9 p-0 justify-center"
            )}
            data-testid="project-switcher-trigger"
            aria-label={collapsed ? "Switch project" : undefined}
          >
            {collapsed ? (
              <FolderOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <>
                <span className="truncate">
                  {activeProject?.name ?? "Select project"}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
              </>
            )}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          className="w-64"
          align="start"
          data-testid="project-switcher-content"
        >
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground px-2 py-1">
            Projects
          </DropdownMenuLabel>

          {/* Search */}
          <div className="px-2 pb-1">
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
              data-testid="project-search-input"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <DropdownMenuSeparator />

          {/* Project list */}
          <div className="max-h-48 overflow-y-auto" data-testid="project-list">
            {filtered.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                No projects found
              </p>
            ) : (
              filtered.map((project) => (
                <div
                  key={project.id}
                  className="group flex items-center gap-1 pr-1"
                >
                  <DropdownMenuItem
                    className="flex-1 cursor-pointer"
                    onSelect={() => setActiveProjectId(project.id)}
                    data-testid={`project-item-${project.id}`}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        project.id === activeProjectId ? "opacity-100" : "opacity-0"
                      )}
                      aria-hidden="true"
                    />
                    <span className="truncate">{project.name}</span>
                  </DropdownMenuItem>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenameProject(project);
                    }}
                    className="shrink-0 rounded p-1 opacity-0 group-hover:opacity-100 hover:bg-accent transition-opacity"
                    aria-label={`Rename ${project.name}`}
                    data-testid={`rename-project-${project.id}`}
                  >
                    <Pencil className="h-3 w-3" aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteProject(project);
                    }}
                    className="shrink-0 rounded p-1 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-opacity"
                    aria-label={`Delete ${project.name}`}
                    data-testid={`delete-project-${project.id}`}
                  >
                    <Trash2 className="h-3 w-3" aria-hidden="true" />
                  </button>
                </div>
              ))
            )}
          </div>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onSelect={() => setCreateOpen(true)}
            className="cursor-pointer text-sm"
            data-testid="create-project-trigger"
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            New project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateProjectModal
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      {renameProject && (
        <RenameProjectDialog
          project={renameProject}
          open={!!renameProject}
          onOpenChange={(open) => !open && setRenameProject(null)}
        />
      )}

      {deleteProject && (
        <DeleteProjectDialog
          project={deleteProject}
          open={!!deleteProject}
          onOpenChange={(open) => !open && setDeleteProject(null)}
        />
      )}
    </>
  );
}
