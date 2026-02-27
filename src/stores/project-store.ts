"use client";

import { create } from "zustand";
import type { Project } from "@/types/project";

const ACTIVE_PROJECT_KEY = "autocoder:activeProjectId";

interface ProjectState {
  projects: Project[];
  activeProjectId: string | null;
  isLoading: boolean;
  error: string | null;
}

interface ProjectActions {
  setProjects: (projects: Project[]) => void;
  setActiveProjectId: (id: string | null) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, name: string) => void;
  removeProject: (id: string) => void;
  fetchProjects: () => Promise<void>;
  createProject: (name: string) => Promise<Project | null>;
  renameProject: (id: string, name: string) => Promise<boolean>;
  deleteProject: (id: string) => Promise<boolean>;
  clearError: () => void;
}

type ProjectStore = ProjectState & ProjectActions;

function loadActiveProjectId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_PROJECT_KEY);
}

function saveActiveProjectId(id: string | null): void {
  if (typeof window === "undefined") return;
  if (id) {
    localStorage.setItem(ACTIVE_PROJECT_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_PROJECT_KEY);
  }
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  activeProjectId: null,
  isLoading: false,
  error: null,

  setProjects: (projects) => set({ projects }),

  setActiveProjectId: (id) => {
    saveActiveProjectId(id);
    set({ activeProjectId: id });
  },

  addProject: (project) =>
    set((state) => ({ projects: [...state.projects, project] })),

  updateProject: (id, name) =>
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, name } : p
      ),
    })),

  removeProject: (id) =>
    set((state) => {
      const projects = state.projects.filter((p) => p.id !== id);
      let activeProjectId = state.activeProjectId;
      if (activeProjectId === id) {
        activeProjectId = projects[0]?.id ?? null;
        saveActiveProjectId(activeProjectId);
      }
      return { projects, activeProjectId };
    }),

  fetchProjects: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error("Failed to fetch projects");
      const projects: Project[] = await res.json();
      const stored = loadActiveProjectId();
      const validId = projects.find((p) => p.id === stored)?.id ?? projects[0]?.id ?? null;
      saveActiveProjectId(validId);
      set({ projects, activeProjectId: validId, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      set({ isLoading: false, error: message });
    }
  },

  createProject: async (name) => {
    set({ error: null });
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        set({ error: data.error ?? "Failed to create project" });
        return null;
      }
      const project: Project = await res.json();
      get().addProject(project);
      get().setActiveProjectId(project.id);
      return project;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      set({ error: message });
      return null;
    }
  },

  renameProject: async (id, name) => {
    set({ error: null });
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        set({ error: data.error ?? "Failed to rename project" });
        return false;
      }
      get().updateProject(id, name);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      set({ error: message });
      return false;
    }
  },

  deleteProject: async (id) => {
    set({ error: null });
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        set({ error: data.error ?? "Failed to delete project" });
        return false;
      }
      get().removeProject(id);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      set({ error: message });
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));
