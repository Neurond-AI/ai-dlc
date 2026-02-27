import { z } from "zod";

// -- Request Changes Schema (BR-06-003) --

export const requestChangesSchema = z.object({
  feedback: z
    .string()
    .min(10, "Feedback must be at least 10 characters")
    .max(5000, "Feedback must be 5000 characters or fewer")
    .trim(),
});

export type RequestChangesInput = z.infer<typeof requestChangesSchema>;

// -- Update Profile Schema (BR-06-012) --

export const updateProfileSchema = z.object({
  name: z
    .string()
    .min(1, "Name cannot be empty")
    .max(100, "Name must be 100 characters or fewer")
    .trim(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
