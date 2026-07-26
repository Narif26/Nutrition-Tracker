import { PrismaClient } from "@prisma/client";
import { getDayStart } from "../src/lib/date";
import { generateSuggestedGoals } from "../src/lib/goals";
import { nutritionRecordToGoalColumns } from "../src/lib/nutrition/helpers";

const prisma = new PrismaClient();
const demoEmail = process.env.DEMO_USER_EMAIL ?? "demo@nutrichat.local";

const profile = {
  age: 28,
  sex: "FEMALE" as const,
  heightCm: 168,
  weightKg: 66,
  activityLevel: "MODERATE" as const,
  goalType: "GAIN_MUSCLE" as const,
};

async function main() {
  const user = await prisma.user.upsert({
    where: {
      email: demoEmail,
    },
    update: {},
    create: {
      email: demoEmail,
      name: "Demo User",
    },
  });

  await prisma.userProfile.upsert({
    where: {
      userId: user.id,
    },
    update: profile,
    create: {
      userId: user.id,
      ...profile,
    },
  });

  await prisma.nutritionGoal.upsert({
    where: {
      userId: user.id,
    },
    update: nutritionRecordToGoalColumns(generateSuggestedGoals(profile)),
    create: {
      userId: user.id,
      ...nutritionRecordToGoalColumns(generateSuggestedGoals(profile)),
    },
  });

  await prisma.entrySourceMetadata.deleteMany({
    where: {
      foodEntry: {
        userId: user.id,
      },
    },
  });

  await prisma.foodEntry.deleteMany({
    where: {
      userId: user.id,
    },
  });

  await prisma.dailySummary.deleteMany({
    where: {
      userId: user.id,
    },
  });

  await prisma.chatMessage.deleteMany({
    where: {
      userId: user.id,
    },
  });

  const today = getDayStart(new Date());
  await prisma.dailySummary.upsert({
    where: {
      userId_date: {
        userId: user.id,
        date: today,
      },
    },
    update: {
      entryCount: 0,
    },
    create: {
      userId: user.id,
      date: today,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      sodium: 0,
      cholesterol: 0,
      saturatedFat: 0,
      potassium: 0,
      calcium: 0,
      iron: 0,
      magnesium: 0,
      vitaminA: 0,
      vitaminC: 0,
      vitaminD: 0,
      vitaminB12: 0,
      entryCount: 0,
    },
  });

  console.log(`Reset NutriChat demo data for ${demoEmail} with an empty food log`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
