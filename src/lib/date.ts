import { eachDayOfInterval, subDays } from "date-fns";
import type { MealType } from "@/types/domain";

const FALLBACK_TIME_ZONE = "UTC";

function isValidTimeZone(timeZone: string) {
  try {
    Intl.DateTimeFormat("en-US", {
      timeZone,
    }).format(new Date());

    return true;
  } catch {
    return false;
  }
}

function getFormatter(
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    ...options,
  });
}

function getDateParts(date: Date, timeZone: string) {
  const parts = getFormatter(timeZone, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error(`Could not resolve local date for time zone "${timeZone}".`);
  }

  return {
    year,
    month,
    day,
  };
}

export function resolveTimeZone(timeZone?: string | null) {
  if (timeZone && isValidTimeZone(timeZone)) {
    return timeZone;
  }

  const configured = process.env.DEFAULT_TIME_ZONE;
  if (configured && isValidTimeZone(configured)) {
    return configured;
  }

  return FALLBACK_TIME_ZONE;
}

export function getDateKey(date = new Date(), timeZone?: string | null) {
  const resolvedTimeZone = resolveTimeZone(timeZone);
  const { year, month, day } = getDateParts(date, resolvedTimeZone);

  return `${year}-${month}-${day}`;
}

export function getDayStart(date = new Date(), timeZone?: string | null) {
  return new Date(`${getDateKey(date, timeZone)}T00:00:00.000Z`);
}

export function dateKeyFromDayStart(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function getDateWindow(
  days: number,
  timeZone?: string | null,
  anchor = new Date(),
) {
  const end = getDayStart(anchor, timeZone);
  const start = subDays(end, days - 1);

  return eachDayOfInterval({ start, end });
}

export function inferMealType(date = new Date(), timeZone?: string | null): MealType {
  const resolvedTimeZone = resolveTimeZone(timeZone);
  const hourParts = getFormatter(resolvedTimeZone, {
    hour: "numeric",
    hour12: false,
  }).formatToParts(date);
  const hour = Number.parseInt(
    hourParts.find((part) => part.type === "hour")?.value ?? "0",
    10,
  );

  if (hour < 11) {
    return "BREAKFAST";
  }

  if (hour < 16) {
    return "LUNCH";
  }

  if (hour < 22) {
    return "DINNER";
  }

  return "SNACK";
}

export function formatSeriesLabel(date: Date, days: number) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    ...(days <= 7
      ? { weekday: "short" as const }
      : { month: "short" as const, day: "numeric" as const }),
  }).format(date);
}
