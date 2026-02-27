"use client";

import { create } from "zustand";
import { authClient } from "@/lib/auth-client";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
  setUser: (user: AuthUser | null) => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isLoading: true,
  error: null,

  hydrate: async () => {
    try {
      set({ isLoading: true, error: null });
      const session = await authClient.getSession();
      if (session?.data?.user) {
        const u = session.data.user;
        set({
          user: {
            id: u.id,
            name: u.name,
            email: u.email,
            image: u.image ?? null,
          },
          isLoading: false,
        });
      } else {
        set({ user: null, isLoading: false });
      }
    } catch {
      set({ user: null, isLoading: false });
    }
  },

  login: async (email: string, password: string) => {
    set({ error: null });
    const result = await authClient.signIn.email({
      email,
      password,
      callbackURL: "/board",
    });
    if (result.error) {
      set({ error: "Invalid email or password" });
      return false;
    }
    if (result.data?.user) {
      const u = result.data.user;
      set({
        user: {
          id: u.id,
          name: u.name,
          email: u.email,
          image: u.image ?? null,
        },
      });
    }
    return true;
  },

  register: async (name: string, email: string, password: string) => {
    set({ error: null });
    const result = await authClient.signUp.email({
      name,
      email,
      password,
      callbackURL: "/board",
    });
    if (result.error) {
      const msg =
        result.error.code === "USER_ALREADY_EXISTS"
          ? "Email already registered"
          : "Something went wrong. Please try again.";
      set({ error: msg });
      return false;
    }
    if (result.data?.user) {
      const u = result.data.user;
      set({
        user: {
          id: u.id,
          name: u.name,
          email: u.email,
          image: u.image ?? null,
        },
      });
    }
    return true;
  },

  logout: async () => {
    await authClient.signOut();
    set({ user: null, error: null });
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  },

  clearError: () => set({ error: null }),

  setUser: (user) => set({ user }),
}));
