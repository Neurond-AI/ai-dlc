import { z } from "zod";
import { TASK_CATEGORIES, TASK_PRIORITIES, TASK_STATUSES } from "@/types/task";

export const createTaskSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be 200 characters or fewer")
    .trim(),
  description: z
    .string()
    .max(5000, "Description must be 5000 characters or fewer")
    .optional()
    .or(z.literal("")),
  category: z.enum(TASK_CATEGORIES, {
    required_error: "Category is required",
  }),
  priority: z.enum(TASK_PRIORITIES, {
    required_error: "Priority is required",
  }),
  projectId: z.string().min(1, "Project ID is required"),
});

export const updateTaskSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be 200 characters or fewer")
    .trim()
    .optional(),
  description: z
    .string()
    .max(5000, "Description must be 5000 characters or fewer")
    .nullable()
    .optional(),
  category: z.enum(TASK_CATEGORIES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  status: z.enum(TASK_STATUSES).optional(),
});

export const moveTaskSchema = z.object({
  status: z.enum(TASK_STATUSES),
  position: z.number().optional(),
});

export const taskQuerySchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  status: z.enum(TASK_STATUSES).optional(),
  category: z.enum(TASK_CATEGORIES).optional(),
  search: z.string().optional(),
});

export type CreateTaskSchema = z.infer<typeof createTaskSchema>;
export type UpdateTaskSchema = z.infer<typeof updateTaskSchema>;
export type MoveTaskSchema = z.infer<typeof moveTaskSchema>;
export type TaskQuerySchema = z.infer<typeof taskQuerySchema>;
