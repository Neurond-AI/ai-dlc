"use client";

import { useCallback, useEffect, useRef } from "react";
import { useTaskStore } from "@/stores/task-store";
import { type TaskCategory, type TaskPriority } from "@/types/task";

const DEBOUNCE_MS = 300;

export function useTaskFilters() {
  const filter = useTaskStore((s) => s.filter);
  const setFilter = useTaskStore((s) => s.setFilter);
  const clearFilters = useTaskStore((s) => s.clearFilters);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  const setSearch = useCallback(
    (search: string) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        setFilter({ search });
      }, DEBOUNCE_MS);
    },
    [setFilter]
  );

  const setCategory = useCallback(
    (category: TaskCategory | null) => {
      setFilter({ category });
    },
    [setFilter]
  );

  const setPriority = useCallback(
    (priority: TaskPriority | null) => {
      setFilter({ priority });
    },
    [setFilter]
  );

  const hasActiveFilters =
    filter.search.length > 0 ||
    filter.category !== null ||
    filter.priority !== null;

  return {
    filter,
    setSearch,
    setCategory,
    setPriority,
    clearFilters,
    hasActiveFilters,
  };
}
