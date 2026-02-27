import { z } from "zod";

export const projectNameSchema = z
  .string()
  .min(1, "Project name is required")
  .max(50, "Project name must be 50 characters or fewer")
  .trim();

export const createProjectSchema = z.object({
  name: projectNameSchema,
});

export const renameProjectSchema = z.object({
  name: projectNameSchema,
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type RenameProjectInput = z.infer<typeof renameProjectSchema>;
