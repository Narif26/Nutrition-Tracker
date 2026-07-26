"use client";

import { format } from "date-fns";
import { Goal, Sparkles } from "lucide-react";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { isCoreMetricKey } from "@/lib/nutrition/config";
import type { AppSnapshot, NutrientProgressItem } from "@/types/app";
import { clamp, formatNutrientValue } from "@/lib/utils";

const chartWindows = [7, 14, 30] as const;

function metricBarClass(key: NutrientProgressItem["key"]) {
  if (key === "calories") {
    return "bg-[linear-gradient(90deg,#0f7b66,#38b49a)]";
  }

  if (key === "protein") {
    return "bg-[linear-gradient(90deg,#e58d2e,#f6b35d)]";
  }

  if (key === "carbs") {
    return "bg-[linear-gradient(90deg,#3281a8,#5fb4dc)]";
  }

  return "bg-[linear-gradient(90deg,#c65b48,#f08d63)]";
}

export function DashboardPanel({
  snapshot,
  onOpenSettings,
}: {
  snapshot: AppSnapshot;
  onOpenSettings: () => void;
}) {
  const [window, setWindow] = useState<(typeof chartWindows)[number]>(7);
  const metricItems = snapshot.today.progress.filter((item) =>
    isCoreMetricKey(item.key),
  );
  const visibleSeries = snapshot.dailySeries.slice(-window);
  const hasCalorieHistory = visibleSeries.some((point) => point.calories > 0);
  const caloriesRemaining = snapshot.today.remainingCalories;

  return (
    <div className="space-y-6">
      <Card className="hero-shell relative overflow-hidden text-white">
        <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <Badge variant="warm" className="bg-white/14 text-white">
              Live dashboard
            </Badge>
            <div className="space-y-1">
              <p className="text-sm uppercase tracking-[0.18em] text-white/74">
                Today
              </p>
              <h2 className="font-display text-5xl font-semibold tracking-[-0.05em]">
                {Math.round(snapshot.today.totals.calories)}
              </h2>
              <p className="text-base text-white/82">
                of {Math.round(snapshot.goals.calories)} kcal goal
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[24px] border border-white/14 bg-white/10 p-4">
              <div className="flex items-center gap-2 text-sm text-white/74">
                <Goal className="h-4 w-4" />
                Remaining
              </div>
              <div className="mt-2 text-2xl font-semibold">
                {caloriesRemaining >= 0
                  ? `${Math.round(caloriesRemaining)} kcal`
                  : `${Math.abs(Math.round(caloriesRemaining))} kcal over`}
              </div>
            </div>
            <div className="rounded-[24px] border border-white/14 bg-white/10 p-4">
              <div className="text-sm text-white/74">Logged today</div>
              <div className="mt-2 text-2xl font-semibold">
                {snapshot.today.entries.length} item
                {snapshot.today.entries.length === 1 ? "" : "s"}
              </div>
            </div>
            <div className="rounded-[24px] border border-white/14 bg-white/10 p-4">
              <div className="flex items-center gap-2 text-sm text-white/74">
                <Sparkles className="h-4 w-4" />
                Goals
              </div>
              <div className="mt-2">
                <Button
                  className="w-full bg-white/18 text-white hover:bg-white/24"
                  onClick={onOpenSettings}
                  type="button"
                  variant="ghost"
                >
                  Update settings
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daily targets</CardTitle>
          <CardDescription>
            Calories, protein, carbs, and fat against today&apos;s goals.
          </CardDescription>
        </CardHeader>

        <div className="space-y-5">
          {metricItems.map((item) => (
            <div key={item.key} className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-[color:var(--foreground)]">{item.label}</p>
                  <p className="text-sm text-[color:var(--muted-foreground)]">
                    {formatNutrientValue(item.current, item.unit)} /{" "}
                    {formatNutrientValue(item.target, item.unit)}
                  </p>
                </div>
                <p className="text-sm font-medium text-[color:var(--muted-foreground)]">
                  {Math.round(item.percent)}%
                </p>
              </div>
              <Progress
                className="h-3"
                indicatorClassName={metricBarClass(item.key)}
                value={clamp(item.percent, 0, 100)}
              />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <CardHeader className="mb-0">
            <CardTitle>Calorie history</CardTitle>
            <CardDescription>
              View the last 7, 14, or 30 days of intake against your daily goal.
            </CardDescription>
          </CardHeader>

          <div className="flex gap-2">
            {chartWindows.map((value) => (
              <Button
                key={value}
                onClick={() => setWindow(value)}
                size="sm"
                type="button"
                variant={window === value ? "default" : "outline"}
              >
                {value}d
              </Button>
            ))}
          </div>
        </div>

        {hasCalorieHistory ? (
          <div className="mt-6 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={visibleSeries}>
                <CartesianGrid stroke="rgba(20,40,44,0.08)" vertical={false} />
                <XAxis
                  axisLine={false}
                  dataKey="label"
                  tick={{ fill: "rgba(31,42,48,0.62)", fontSize: 12 }}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(15,123,102,0.08)" }}
                  formatter={(value) => [`${Math.round(Number(value ?? 0))} kcal`, "Calories"]}
                  labelFormatter={(label) => `${label}`}
                  contentStyle={{
                    borderRadius: 18,
                    border: "1px solid rgba(27,49,54,0.08)",
                    boxShadow: "0 18px 34px rgba(27,49,54,0.12)",
                  }}
                />
                <ReferenceLine
                  stroke="rgba(214,160,97,0.75)"
                  strokeDasharray="5 5"
                  y={snapshot.goals.calories}
                />
                <Bar
                  dataKey="calories"
                  fill="url(#calorieGradient)"
                  radius={[12, 12, 0, 0]}
                />
                <defs>
                  <linearGradient id="calorieGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#0f7b66" />
                    <stop offset="100%" stopColor="#60bca8" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="mt-6 rounded-[24px] border border-dashed border-[color:var(--border)] bg-white/48 px-4 py-10 text-center text-sm text-[color:var(--muted-foreground)]">
            No calorie history yet. Bars will appear after you log food from chat.
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Food log</CardTitle>
          <CardDescription>
            One running list of everything logged from chat today.
          </CardDescription>
        </CardHeader>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-[color:var(--muted-foreground)]">
              Most recent entries appear first.
            </p>
            <Badge>
              {snapshot.today.entries.length} item{snapshot.today.entries.length === 1 ? "" : "s"}
            </Badge>
          </div>

          {snapshot.today.entries.length > 0 ? (
            snapshot.today.entries.map((entry, index) => (
              <div key={entry.id} className="space-y-3">
                <div className="rounded-[24px] border border-[color:var(--border)] bg-white/72 px-4 py-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold text-[color:var(--foreground)]">
                          {entry.description}
                        </p>
                        {entry.source.isAmbiguous ? (
                          <Badge variant="warm">closest match</Badge>
                        ) : null}
                        <Badge variant="accent">{entry.source.type}</Badge>
                      </div>
                      <p className="text-sm text-[color:var(--muted-foreground)]">
                        {entry.quantityText} · logged {format(new Date(entry.loggedAt), "h:mm a")}
                      </p>
                      <p className="text-sm text-[color:var(--muted-foreground)]">
                        Matched to {entry.source.matchedDescription}
                        {entry.source.brandName ? ` · ${entry.source.brandName}` : ""}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge>{Math.round(entry.nutrients.calories)} kcal</Badge>
                      <Badge>P {Math.round(entry.nutrients.protein)}g</Badge>
                      <Badge>C {Math.round(entry.nutrients.carbs)}g</Badge>
                      <Badge>F {Math.round(entry.nutrients.fat)}g</Badge>
                    </div>
                  </div>
                </div>

                {index < snapshot.today.entries.length - 1 ? <Separator /> : null}
              </div>
            ))
          ) : (
            <div className="rounded-[24px] border border-dashed border-[color:var(--border)] bg-white/48 px-4 py-4 text-sm text-[color:var(--muted-foreground)]">
              Nothing logged here yet. Use the chat on the left to add or edit items.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
