"use client";

import React from "react";
import Link from "next/link";
import { Menu, KanbanSquare } from "lucide-react";
import { useUIStore } from "@/stores/ui-store";
import { useProjectStore } from "@/stores/project-store";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";

export function Header() {
  const { toggleSidebar } = useUIStore();
  const { projects, activeProjectId } = useProjectStore();
  const activeProject = projects.find((p) => p.id === activeProjectId);

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-card px-4 lg:px-6">
      {/* Mobile hamburger */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
        data-testid="hamburger-menu"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </Button>

      {/* Logo (mobile only) */}
      <Link
        href="/board"
        className="flex items-center gap-2 lg:hidden"
        data-testid="app-logo"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded bg-primary text-primary-foreground">
          <KanbanSquare className="h-4 w-4" />
        </div>
        <span className="font-semibold text-sm">AutoCoder</span>
      </Link>

      {/* Center: project name */}
      <div className="flex flex-1 items-center justify-center">
        <span
          className="text-sm font-medium text-muted-foreground"
          data-testid="project-name"
        >
          {activeProject?.name ?? ""}
        </span>
      </div>

      {/* Right: user menu */}
      <div className="flex items-center gap-2">
        <UserMenu />
      </div>
    </header>
  );
}
