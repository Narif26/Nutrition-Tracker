import { db } from "@/lib/db";
import { generateSuggestedGoals } from "@/lib/goals";
import { nutritionRecordToGoalColumns } from "@/lib/nutrition/helpers";
import type { ActivityLevel, GoalType, Sex } from "@/types/domain";

const DEMO_USER_EMAIL = process.env.DEMO_USER_EMAIL ?? "demo@nutrichat.local";

const defaultProfile = {
  age: 29,
  sex: "PREFER_NOT_TO_SAY" as Sex,
  heightCm: 173,
  weightKg: 73,
  activityLevel: "MODERATE" as ActivityLevel,
  goalType: "MAINTAIN" as GoalType,
};

export async function ensureDemoUser() {
  let user = await db.user.findUnique({
    where: { email: DEMO_USER_EMAIL },
    include: {
      profile: true,
      goals: true,
    },
  });

  if (!user) {
    user = await db.user.create({
      data: {
        email: DEMO_USER_EMAIL,
        name: "Demo User",
        profile: {
          create: defaultProfile,
        },
        goals: {
          create: nutritionRecordToGoalColumns(generateSuggestedGoals(defaultProfile)),
        },
      },
      include: {
        profile: true,
        goals: true,
      },
    });

    return user;
  }

  if (!user.profile) {
    await db.userProfile.create({
      data: {
        userId: user.id,
        ...defaultProfile,
      },
    });
  }

  if (!user.goals) {
    await db.nutritionGoal.create({
      data: {
        userId: user.id,
        ...nutritionRecordToGoalColumns(generateSuggestedGoals(defaultProfile)),
      },
    });
  }

  return db.user.findUniqueOrThrow({
    where: { id: user.id },
    include: {
      profile: true,
      goals: true,
    },
  });
}
