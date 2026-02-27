"use client";

import React from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { BottomDock } from "@/components/layout/bottom-dock";
import { useProjectInit } from "@/hooks/use-project-init";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  useProjectInit();

  return (
    <div className="flex h-screen overflow-hidden bg-background" data-testid="app-shell">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />

        <main className="flex-1 overflow-auto p-6" role="main">
          {children}
        </main>

        <BottomDock />
      </div>
    </div>
  );
}
