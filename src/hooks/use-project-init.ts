"use client";

import { useEffect, useRef } from "react";
import { useProjectStore } from "@/stores/project-store";
import { useSession } from "@/hooks/use-session";

const DEFAULT_PROJECT_NAME = "My Project";

/**
 * Initializes the project store:
 * 1. Fetches projects for the authenticated user.
 * 2. If the user has no projects, auto-creates "My Project".
 *
 * Must be called inside a component that is rendered after authentication.
 */
export function useProjectInit() {
  const { user, isLoading: sessionLoading } = useSession();
  const { fetchProjects, createProject, projects, isLoading } = useProjectStore();
  const initialized = useRef(false);

  useEffect(() => {
    if (sessionLoading || !user || initialized.current) return;
    initialized.current = true;

    const init = async () => {
      await fetchProjects();
      // After fetch, check store state directly
      const state = useProjectStore.getState();
      if (state.projects.length === 0) {
        await createProject(DEFAULT_PROJECT_NAME);
      }
    };

    init();
  }, [user, sessionLoading, fetchProjects, createProject]);

  return { isLoading: isLoading || sessionLoading, projects };
}
