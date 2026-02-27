import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "@/lib/db";

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),

  session: {
    // 7 days in seconds
    expiresIn: 604800,
    // Update session age if older than 24h (sliding window)
    updateAge: 86400,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes cache
    },
  },

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    requireEmailVerification: false,
  },

  rateLimit: {
    window: 900, // 15 minutes in seconds
    max: 5, // 5 attempts per window for sign-in
    storage: "memory",
  },

  advanced: {
    cookiePrefix: "ac",
    generateId: () => crypto.randomUUID(),
  },
});

export type Auth = typeof auth;
