"use client";

import { useState } from "react";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  activityLevelLabels,
  coreMetricDefinitions,
  goalTypeLabels,
  sexLabels,
} from "@/lib/nutrition/config";
import type { GoalSnapshot, ProfileSnapshot, SettingsPayload } from "@/types/app";

type OverrideState = Record<string, string>;

const overrideInitialState = coreMetricDefinitions.reduce<OverrideState>(
  (accumulator, nutrient) => {
    accumulator[nutrient.key] = "";
    return accumulator;
  },
  {},
);

function numberInputValue(value: number | null) {
  return value === null ? "" : String(value);
}

export function SettingsDialog({
  open,
  onOpenChange,
  profile,
  goals,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: ProfileSnapshot;
  goals: GoalSnapshot;
  saving: boolean;
  onSave: (payload: SettingsPayload) => Promise<void>;
}) {
  const [age, setAge] = useState(numberInputValue(profile.age));
  const [sex, setSex] = useState(profile.sex ?? "PREFER_NOT_TO_SAY");
  const [heightCm, setHeightCm] = useState(numberInputValue(profile.heightCm));
  const [weightKg, setWeightKg] = useState(numberInputValue(profile.weightKg));
  const [activityLevel, setActivityLevel] = useState(profile.activityLevel ?? "MODERATE");
  const [goalType, setGoalType] = useState(profile.goalType ?? "MAINTAIN");
  const [overrides, setOverrides] = useState<OverrideState>(overrideInitialState);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    try {
      setError(null);

      const payload: SettingsPayload = {
        profile: {
          age: Number(age),
          sex,
          heightCm: Number(heightCm),
          weightKg: Number(weightKg),
          activityLevel,
          goalType,
        },
        overrides: {},
      };

      for (const [key, value] of Object.entries(overrides)) {
        if (!value.trim()) {
          continue;
        }

        payload.overrides[key as keyof SettingsPayload["overrides"]] = Number(value);
      }

      await onSave(payload);
      onOpenChange(false);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not save your settings.",
      );
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[92vh] overflow-hidden p-0">
        <div className="max-h-[92vh] overflow-y-auto p-6 sm:p-7">
          <DialogHeader>
            <DialogTitle>Personalize your nutrition goals</DialogTitle>
            <DialogDescription>
              NutriChat uses your profile to generate calorie and macro targets,
              then lets you override any nutrient manually for the day.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-8 xl:grid-cols-[0.8fr_1.2fr]">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="age">Age</Label>
                  <Input id="age" onChange={(event) => setAge(event.target.value)} type="number" value={age} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sex">Sex</Label>
                  <select
                    className="h-11 w-full rounded-2xl border border-[color:var(--border)] bg-white/80 px-4 text-sm outline-none transition focus:border-[color:var(--accent)]/40"
                    id="sex"
                    onChange={(event) => setSex(event.target.value as typeof sex)}
                    value={sex}
                  >
                    {Object.entries(sexLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="height">Height (cm)</Label>
                  <Input
                    id="height"
                    onChange={(event) => setHeightCm(event.target.value)}
                    type="number"
                    value={heightCm}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weight">Weight (kg)</Label>
                  <Input
                    id="weight"
                    onChange={(event) => setWeightKg(event.target.value)}
                    type="number"
                    value={weightKg}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="activity">Activity level</Label>
                  <select
                    className="h-11 w-full rounded-2xl border border-[color:var(--border)] bg-white/80 px-4 text-sm outline-none transition focus:border-[color:var(--accent)]/40"
                    id="activity"
                    onChange={(event) =>
                      setActivityLevel(event.target.value as typeof activityLevel)
                    }
                    value={activityLevel}
                  >
                    {Object.entries(activityLevelLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="goal">Primary goal</Label>
                  <select
                    className="h-11 w-full rounded-2xl border border-[color:var(--border)] bg-white/80 px-4 text-sm outline-none transition focus:border-[color:var(--accent)]/40"
                    id="goal"
                    onChange={(event) => setGoalType(event.target.value as typeof goalType)}
                    value={goalType}
                  >
                    {Object.entries(goalTypeLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rounded-[24px] border border-[color:var(--border)] bg-white/72 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-[color:var(--foreground)]">
                      Suggested goals engine
                    </p>
                    <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
                      Save with no overrides to regenerate goals from the profile
                      above.
                    </p>
                  </div>
                  <Button
                    onClick={() => setOverrides(overrideInitialState)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <RefreshCcw className="h-3.5 w-3.5" />
                    Clear overrides
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="font-display text-xl font-semibold tracking-[-0.03em]">
                  Manual overrides
                </p>
                <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
                  Leave a field blank to keep the profile-generated target. For
                  now, overrides are limited to calories and core macros.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {coreMetricDefinitions.map((nutrient) => (
                  <div key={nutrient.key} className="space-y-2">
                    <Label htmlFor={nutrient.key}>
                      {nutrient.label} ({nutrient.unit})
                    </Label>
                    <Input
                      id={nutrient.key}
                      onChange={(event) =>
                        setOverrides((current) => ({
                          ...current,
                          [nutrient.key]: event.target.value,
                        }))
                      }
                      placeholder={`Current: ${goals[nutrient.key]}`}
                      type="number"
                      value={overrides[nutrient.key]}
                    />
                    <p className="text-xs text-[color:var(--muted-foreground)]">
                      Active goal: {goals[nutrient.key]} {nutrient.unit}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {error ? (
            <div className="mt-6 rounded-2xl border border-[#d8b5a0] bg-[#fff3ea] px-4 py-3 text-sm text-[#8c4c23]">
              {error}
            </div>
          ) : null}

          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} type="button" variant="ghost">
              Close
            </Button>
            <Button disabled={saving} onClick={handleSubmit} type="button">
              {saving ? "Saving..." : "Save goals"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
