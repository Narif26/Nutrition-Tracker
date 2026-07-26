import { z } from "zod";
import {
  activityLevelValues,
  goalTypeValues,
  sexValues,
} from "@/types/domain";

const optionalNumber = z
  .number()
  .positive()
  .max(10000)
  .optional();

export const settingsSchema = z.object({
  timeZone: z.string().trim().max(100).optional(),
  profile: z.object({
    age: z.number().int().min(12).max(100),
    sex: z.enum(sexValues),
    heightCm: z.number().min(90).max(260),
    weightKg: z.number().min(25).max(350),
    activityLevel: z.enum(activityLevelValues),
    goalType: z.enum(goalTypeValues),
  }),
  overrides: z.object({
    calories: optionalNumber,
    protein: optionalNumber,
    carbs: optionalNumber,
    fat: optionalNumber,
  }),
});
