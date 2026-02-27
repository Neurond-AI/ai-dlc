"use client";

import { create } from "zustand";
import type {
  Task,
  TaskStatus,
  TaskFilter,
  CreateTaskInput,
  UpdateTaskInput,
  PipelineState,
} from "@/types/task";

interface TaskState {
  tasks: Task[];
  isLoading: boolean;
  error: string | null;
  filter: TaskFilter;
}

interface TaskActions {
  fetchTasks: (projectId: string) => Promise<void>;
  createTask: (data: CreateTaskInput) => Promise<Task>;
  updateTask: (id: string, data: UpdateTaskInput) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  moveTask: (id: string, newStatus: TaskStatus) => void;
  updateTaskStatus: (id: string, newStatus: TaskStatus) => void;
  updatePipelineState: (id: string, state: PipelineState) => void;
  setFilter: (filter: Partial<TaskFilter>) => void;
  clearFilters: () => void;
  reset: () => void;
  getTasksByStatus: (status: TaskStatus) => Task[];
}

type TaskStore = TaskState & TaskActions;

const DEFAULT_FILTER: TaskFilter = {
  search: "",
  category: null,
  priority: null,
};

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  isLoading: false,
  error: null,
  filter: DEFAULT_FILTER,

  fetchTasks: async (projectId: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`/api/tasks?projectId=${encodeURIComponent(projectId)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to fetch tasks");
      }
      const body = await res.json();
      set({ tasks: body.tasks ?? [], isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to fetch tasks",
        isLoading: false,
      });
    }
  },

  createTask: async (data: CreateTaskInput) => {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Failed to create task");
    }
    const body = await res.json();
    const task: Task = body.task;
    set((state) => ({ tasks: [task, ...state.tasks] }));
    return task;
  },

  updateTask: async (id: string, data: UpdateTaskInput) => {
    const previousTasks = get().tasks;
    // Optimistic update
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, ...data, updatedAt: new Date().toISOString() } : t
      ),
    }));
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        set({ tasks: previousTasks });
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to update task");
      }
      const body = await res.json();
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === id ? body.task : t)),
      }));
    } catch (err) {
      set({ tasks: previousTasks });
      throw err;
    }
  },

  deleteTask: async (id: string) => {
    const previousTasks = get().tasks;
    // Optimistic removal
    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }));
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      if (!res.ok) {
        set({ tasks: previousTasks });
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to delete task");
      }
    } catch (err) {
      set({ tasks: previousTasks });
      throw err;
    }
  },

  moveTask: (id: string, newStatus: TaskStatus) => {
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id
          ? { ...t, status: newStatus, updatedAt: new Date().toISOString() }
          : t
      ),
    }));
  },

  updateTaskStatus: (id: string, newStatus: TaskStatus) => {
    get().moveTask(id, newStatus);
  },

  updatePipelineState: (id: string, state: PipelineState) => {
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id
          ? { ...t, pipelineState: state, updatedAt: new Date().toISOString() }
          : t
      ),
    }));
  },

  setFilter: (filter: Partial<TaskFilter>) => {
    set((state) => ({ filter: { ...state.filter, ...filter } }));
  },

  clearFilters: () => {
    set({ filter: DEFAULT_FILTER });
  },

  reset: () => {
    set({ tasks: [], isLoading: false, error: null, filter: DEFAULT_FILTER });
  },

  getTasksByStatus: (status: TaskStatus): Task[] => {
    // Read from current state via get() so this works both as action and selector
    const state = get();
    const { tasks, filter } = state;
    return tasks
      .filter((t) => {
        if (t.status !== status) return false;
        if (filter.category && t.category !== filter.category) return false;
        if (filter.priority && t.priority !== filter.priority) return false;
        if (filter.search) {
          const q = filter.search.toLowerCase();
          if (
            !t.title.toLowerCase().includes(q) &&
            !(t.description ?? "").toLowerCase().includes(q)
          ) {
            return false;
          }
        }
        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
  },
}));
