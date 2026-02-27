"use client";

import { create } from "zustand";
import { LOG_PANEL_DEFAULT_HEIGHT } from "@/lib/constants/pipeline-nodes";

type LogTab = "planner" | "coder" | "reviewer";

interface UIState {
  isSidebarCollapsed: boolean;
  isBottomDockOpen: boolean;
  isTaskModalOpen: boolean;
  activeLogTab: LogTab;
  selectedTaskId: string | null;
  // UOW-05 extensions
  activeLogTaskId: string | null;
  isLogPanelExpanded: boolean;
  logPanelHeight: number;
}

interface UIActions {
  toggleSidebar: () => void;
  toggleBottomDock: () => void;
  openTaskModal: () => void;
  closeTaskModal: () => void;
  setActiveLogTab: (tab: LogTab) => void;
  selectTask: (taskId: string | null) => void;
  // UOW-05 extensions
  setActiveLogTaskId: (taskId: string | null) => void;
  toggleLogPanel: () => void;
  setLogPanelHeight: (height: number) => void;
}

type UIStore = UIState & UIActions;

export const useUIStore = create<UIStore>((set) => ({
  isSidebarCollapsed: false,
  isBottomDockOpen: false,
  isTaskModalOpen: false,
  activeLogTab: "planner",
  selectedTaskId: null,
  activeLogTaskId: null,
  isLogPanelExpanded: false,
  logPanelHeight: LOG_PANEL_DEFAULT_HEIGHT,

  toggleSidebar: () =>
    set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),

  toggleBottomDock: () =>
    set((state) => ({ isBottomDockOpen: !state.isBottomDockOpen })),

  openTaskModal: () => set({ isTaskModalOpen: true }),

  closeTaskModal: () => set({ isTaskModalOpen: false, selectedTaskId: null }),

  setActiveLogTab: (tab) => set({ activeLogTab: tab }),

  selectTask: (taskId) => set({ selectedTaskId: taskId }),

  setActiveLogTaskId: (taskId) => set({ activeLogTaskId: taskId }),

  toggleLogPanel: () =>
    set((state) => ({ isLogPanelExpanded: !state.isLogPanelExpanded })),

  setLogPanelHeight: (height) => set({ logPanelHeight: height }),
}));
