import { z } from "zod";

export const chatMessageSchema = z.object({
  message: z.string().trim().min(1).max(400),
  timeZone: z.string().trim().max(100).optional(),
});
