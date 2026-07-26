import type {
  ActivityLevel,
  GoalType,
  MealType,
  MessageIntent,
  MessageRole,
  Sex,
  SourceType,
} from "@/types/domain";
import type { TrackedNutrientKey } from "@/lib/nutrition/config";
import type { NutritionRecord } from "@/types/nutrition";

export interface ProfileSnapshot {
  age: number | null;
  sex: Sex | null;
  heightCm: number | null;
  weightKg: number | null;
  activityLevel: ActivityLevel | null;
  goalType: GoalType | null;
  isComplete: boolean;
}

export interface GoalSnapshot extends NutritionRecord {
  updatedAt: string | null;
}

export interface FoodEntryView {
  id: string;
  description: string;
  originalInput: string;
  quantityText: string;
  mealType: MealType;
  loggedAt: string;
  nutrients: NutritionRecord;
  source: {
    type: SourceType;
    name: string;
    matchedDescription: string;
    brandName: string | null;
    externalId: string | null;
    confidence: number | null;
    householdServingText: string | null;
    isAmbiguous: boolean;
    query: string;
  };
}

export interface ChatMessageView {
  id: string;
  role: MessageRole;
  intent: MessageIntent | null;
  content: string;
  createdAt: string;
}

export interface NutrientProgressItem {
  key: TrackedNutrientKey;
  label: string;
  unit: string;
  current: number;
  target: number;
  remaining: number;
  percent: number;
  kind: "minimum" | "maximum";
}

export interface DailySeriesPoint {
  date: string;
  label: string;
  calories: number;
  goal: number;
}

export interface AppSnapshot {
  generatedAt: string;
  runtime: {
    parserMode: "OPENAI" | "OPENAI_REQUIRED";
    model: string;
    timeZone: string;
  };
  user: {
    email: string;
    name: string | null;
    mode: "DEMO";
  };
  profile: ProfileSnapshot;
  goals: GoalSnapshot;
  messages: ChatMessageView[];
  today: {
    date: string;
    totals: NutritionRecord;
    entries: FoodEntryView[];
    progress: NutrientProgressItem[];
    remainingCalories: number;
  };
  dailySeries: DailySeriesPoint[];
}

export interface SettingsPayload {
  timeZone?: string;
  profile: {
    age: number;
    sex: Sex;
    heightCm: number;
    weightKg: number;
    activityLevel: ActivityLevel;
    goalType: GoalType;
  };
  overrides: Partial<Record<TrackedNutrientKey, number>>;
}
