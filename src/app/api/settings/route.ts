import { NextResponse } from "next/server";
import { ensureDemoUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateSuggestedGoals, mergeGoalOverrides } from "@/lib/goals";
import { nutritionRecordToGoalColumns } from "@/lib/nutrition/helpers";
import { getAppSnapshot } from "@/lib/services/dashboard";
import { settingsSchema } from "@/lib/validations/settings";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = settingsSchema.parse(await request.json());
    const user = await ensureDemoUser();
    const generatedGoals = generateSuggestedGoals(payload.profile);
    const mergedGoals = mergeGoalOverrides(generatedGoals, payload.overrides);

    await db.$transaction(async (tx) => {
      await tx.userProfile.upsert({
        where: {
          userId: user.id,
        },
        update: payload.profile,
        create: {
          userId: user.id,
          ...payload.profile,
        },
      });

      await tx.nutritionGoal.upsert({
        where: {
          userId: user.id,
        },
        update: nutritionRecordToGoalColumns(mergedGoals),
        create: {
          userId: user.id,
          ...nutritionRecordToGoalColumns(mergedGoals),
        },
      });

      await tx.chatMessage.create({
        data: {
          userId: user.id,
          role: "ASSISTANT",
          intent: "SET_GOALS",
          content: "Settings saved. Your goals and dashboard are using the new profile now.",
        },
      });
    });

    return NextResponse.json({
      ok: true,
      snapshot: await getAppSnapshot({
        timeZone: payload.timeZone,
      }),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Could not save settings.",
      },
      {
        status: 400,
      },
    );
  }
}
