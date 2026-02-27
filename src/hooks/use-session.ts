"use client";

import { useSession as useBetterAuthSession } from "@/lib/auth-client";
import type { AuthUser } from "@/stores/auth-store";

interface SessionResult {
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
  session: {
    id: string;
    token: string;
    expiresAt: Date;
    userId: string;
  } | null;
}

export function useSession(): SessionResult {
  const { data, isPending, error } = useBetterAuthSession();

  const user: AuthUser | null = data?.user
    ? {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        image: data.user.image ?? null,
      }
    : null;

  const session = data?.session
    ? {
        id: data.session.id,
        token: data.session.token,
        expiresAt: new Date(data.session.expiresAt),
        userId: data.session.userId,
      }
    : null;

  return {
    user,
    isLoading: isPending,
    error: error?.message ?? null,
    session,
  };
}
