import { z } from "zod";

export const wardrobeTaskInputSchema = z.object({
  goal: z.string(),
  conversation: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string(),
    }),
  ).default([]),
});

export const wardrobeTaskOutputSchema = z.object({
  summary: z.string(),
  items: z.array(z.string()).default([]),
});

export type WardrobeTaskInput = z.infer<typeof wardrobeTaskInputSchema>;
export type WardrobeTaskOutput = z.infer<typeof wardrobeTaskOutputSchema>;
