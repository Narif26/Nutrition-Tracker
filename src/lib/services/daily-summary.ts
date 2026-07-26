import type { PrismaClient, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getDayStart } from "@/lib/date";
import {
  addNutritionRecords,
  createEmptyNutritionRecord,
  nutritionFromRow,
  nutritionRecordToColumns,
} from "@/lib/nutrition/helpers";

type SummaryClient = Prisma.TransactionClient | PrismaClient;

function isUtcDayStart(date: Date) {
  return (
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0
  );
}

export async function recomputeDailySummary(
  userId: string,
  date: Date,
  client: SummaryClient = db,
  timeZone?: string | null,
) {
  // Callers sometimes pass a raw timestamp and sometimes an already-normalized
  // `loggedDay` value. Re-normalizing a UTC day-start through a local timezone
  // can shift it backward by one day, so preserve canonical day keys as-is.
  const day = isUtcDayStart(date) ? date : getDayStart(date, timeZone);
  const entries = await client.foodEntry.findMany({
    where: {
      userId,
      loggedDay: day,
      deletedAt: null,
    },
  });

  const totals = entries.reduce((accumulator, entry) => {
    return addNutritionRecords(accumulator, nutritionFromRow(entry));
  }, createEmptyNutritionRecord());

  const columns = nutritionRecordToColumns(totals);

  return client.dailySummary.upsert({
    where: {
      userId_date: {
        userId,
        date: day,
      },
    },
    update: {
      ...columns,
      entryCount: entries.length,
    },
    create: {
      userId,
      date: day,
      ...columns,
      entryCount: entries.length,
    },
  });
}
