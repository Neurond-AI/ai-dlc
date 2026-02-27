"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { KanbanSquare, Settings, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ProjectSwitcher } from "@/components/projects/project-switcher";

const navItems = [
  { icon: KanbanSquare, label: "Board", href: "/board" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export function Sidebar() {
  const { isSidebarCollapsed, toggleSidebar } = useUIStore();
  const pathname = usePathname();

  return (
    <TooltipProvider delayDuration={0}>
      {/* Mobile overlay backdrop */}
      <AnimatePresence>
        {!isSidebarCollapsed && (
          <motion.div
            className="fixed inset-0 z-20 bg-black/50 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={toggleSidebar}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        className={cn(
          "relative z-30 flex h-full flex-col border-r bg-card",
          "max-lg:fixed max-lg:left-0 max-lg:top-0",
          isSidebarCollapsed
            ? "max-lg:-translate-x-full"
            : "max-lg:translate-x-0"
        )}
        animate={{
          width: isSidebarCollapsed ? "64px" : "240px",
        }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        data-testid="sidebar"
      >
        {/* Logo / App name */}
        <div className="flex h-14 items-center border-b px-3">
          <Link
            href="/board"
            className="flex items-center gap-2 overflow-hidden"
            data-testid="app-logo"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-primary text-primary-foreground">
              <KanbanSquare className="h-4 w-4" />
            </div>
            <AnimatePresence>
              {!isSidebarCollapsed && (
                <motion.span
                  className="whitespace-nowrap font-semibold text-sm"
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  AutoCoder
                </motion.span>
              )}
            </AnimatePresence>
          </Link>

          {/* Mobile close button */}
          <button
            className="ml-auto lg:hidden"
            onClick={toggleSidebar}
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 space-y-1 p-2" aria-label="Main navigation">
          {navItems.map(({ icon: Icon, label, href }) => {
            const isActive =
              pathname === href || pathname.startsWith(`${href}/`);

            const linkContent = (
              <Link
                href={href}
                className={cn(
                  "flex h-9 items-center gap-3 rounded-md px-2 text-sm font-medium transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground"
                )}
                data-testid={`nav-${label.toLowerCase()}`}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <AnimatePresence>
                  {!isSidebarCollapsed && (
                    <motion.span
                      className="overflow-hidden whitespace-nowrap"
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      {label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            );

            if (isSidebarCollapsed) {
              return (
                <Tooltip key={href}>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent side="right">{label}</TooltipContent>
                </Tooltip>
              );
            }

            return <div key={href}>{linkContent}</div>;
          })}
        </nav>

        {/* Project switcher */}
        <div className="border-t p-2" data-testid="sidebar-project-section">
          <ProjectSwitcher collapsed={isSidebarCollapsed} />
        </div>
      </motion.aside>

      {/* Sidebar toggle button (desktop) */}
      <button
        className="fixed bottom-4 left-4 z-40 hidden lg:flex h-6 w-6 items-center justify-center rounded border bg-background shadow-sm hover:bg-accent"
        onClick={toggleSidebar}
        aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        data-testid="sidebar-toggle"
      >
        <motion.div
          animate={{ rotate: isSidebarCollapsed ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <Settings className="h-3 w-3" />
        </motion.div>
      </button>
    </TooltipProvider>
  );
}
