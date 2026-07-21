"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { paceSecPerMiToString } from "@/lib/units";

export interface WorkoutView {
  id: number;
  date: string;
  weekNumber: number;
  phase: string;
  workoutType: string;
  targetDistanceMi: number | null;
  description: string;
  status: string;
  adjustmentNote: string | null;
  activity: { distanceMi: number; movingTimeSec: number; avgPaceSecPerMi: number | null } | null;
}

export interface PlanView {
  id: number;
  goalName: string;
  goalDistanceMi: number;
  raceDate: string;
  startDate: string;
  longRunDay: string;
  workouts: WorkoutView[];
}

export interface ActivityView {
  id: number;
  name: string | null;
  date: string;
  distanceMi: number;
  movingTimeSec: number;
  avgPaceSecPerMi: number | null;
}

const STATUS_STYLES: Record<string, string> = {
  SCHEDULED: "border-neutral-300 dark:border-neutral-700",
  COMPLETED: "border-green-500 bg-green-50 dark:bg-green-950",
  MISSED: "border-red-400 bg-red-50 dark:bg-red-950",
  ADJUSTED: "border-amber-400 bg-amber-50 dark:bg-amber-950",
  SKIPPED: "border-neutral-300 dark:border-neutral-700 opacity-60",
};

function isSameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

function startOfWeek(d: Date) {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  s.setDate(s.getDate() - s.getDay());
  return s;
}

export default function PlanDashboard({
  plan,
  activities,
  stravaConnected,
}: {
  plan: PlanView;
  activities: ActivityView[];
  stravaConnected: boolean;
}) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const today = new Date();
  const thisWeekStart = startOfWeek(today);
  const [weekStart, setWeekStart] = useState(thisWeekStart);

  const raceDate = new Date(plan.raceDate);
  const daysToRace = Math.ceil((raceDate.getTime() - today.getTime()) / 86400000);

  // Bound navigation to roughly a year of history (matches how far back activities are fetched)
  // through a week past the race, so the arrows can't scroll into a guaranteed-empty void.
  const earliestWeek = startOfWeek(new Date(today.getTime() - 365 * 86400000));
  const latestWeek = startOfWeek(new Date(raceDate.getTime() + 7 * 86400000));
  const canGoEarlier = weekStart.getTime() > earliestWeek.getTime();
  const canGoLater = weekStart.getTime() < latestWeek.getTime();

  function shiftWeek(days: number) {
    setWeekStart((prev) => new Date(prev.getTime() + days * 86400000));
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * 86400000));
  const weekWorkouts = weekDays.map((day) => plan.workouts.find((w) => isSameDay(new Date(w.date), day)));
  // Actual runs for this week looked up independently of any planned workout, so days before the
  // plan existed (or extra unplanned runs) still show what was actually run.
  const weekActivities = weekDays.map((day) => activities.find((a) => isSameDay(new Date(a.date), day)));
  const isViewingCurrentWeek = isSameDay(weekStart, thisWeekStart);
  const todayWorkout = isViewingCurrentWeek ? plan.workouts.find((w) => isSameDay(new Date(w.date), today)) : undefined;

  async function updateWorkout(id: number, data: Record<string, unknown>) {
    setUpdatingId(id);
    try {
      await fetch(`/api/workouts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      router.refresh();
    } finally {
      setUpdatingId(null);
    }
  }

  async function syncStrava() {
    setSyncing(true);
    try {
      await fetch("/api/strava/sync", { method: "POST" });
      router.refresh();
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-bold">{plan.goalName}</h1>
          <p className="text-sm text-neutral-500">
            {plan.goalDistanceMi}mi on {raceDate.toDateString()} · {daysToRace >= 0 ? `${daysToRace} days out` : "raced"}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => shiftWeek(-7)}
          disabled={!canGoEarlier}
          className="px-2.5 py-1 text-xs font-medium border border-neutral-300 dark:border-neutral-700 rounded-md disabled:opacity-30"
        >
          ← Prev week
        </button>
        <div className="text-center">
          <div className="text-sm font-medium">
            {weekDays[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} –{" "}
            {weekDays[6].toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
          </div>
          {!isViewingCurrentWeek && (
            <button
              type="button"
              onClick={() => setWeekStart(thisWeekStart)}
              className="text-xs text-neutral-500 underline underline-offset-2"
            >
              Back to this week
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => shiftWeek(7)}
          disabled={!canGoLater}
          className="px-2.5 py-1 text-xs font-medium border border-neutral-300 dark:border-neutral-700 rounded-md disabled:opacity-30"
        >
          Next week →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((day, i) => {
          const w = weekWorkouts[i];
          const a = weekActivities[i];
          const isToday = isSameDay(day, today);
          const cellStyle = w
            ? STATUS_STYLES[w.status]
            : a
              ? "border-blue-300 bg-blue-50 dark:bg-blue-950 dark:border-blue-800"
              : "border-neutral-200 dark:border-neutral-800";
          return (
            <div
              key={i}
              className={`rounded-lg border p-2 text-center ${cellStyle} ${
                isToday ? "ring-2 ring-neutral-900 dark:ring-white" : ""
              }`}
            >
              <div className="text-[10px] uppercase text-neutral-500">
                {day.toLocaleDateString(undefined, { weekday: "short" })} {day.getDate()}
              </div>
              <div className="text-xs font-medium mt-0.5">{w ? w.workoutType : a ? "Run" : "—"}</div>
              <div className="text-[11px] text-neutral-500">{w?.targetDistanceMi ? `${w.targetDistanceMi}mi` : ""}</div>
              {a && (
                <div className="text-[11px] text-green-700 dark:text-green-400 mt-0.5">{a.distanceMi.toFixed(1)}mi actual</div>
              )}
            </div>
          );
        })}
      </div>

      {todayWorkout && (
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">
              Today — {todayWorkout.workoutType}
              {todayWorkout.targetDistanceMi ? ` · ${todayWorkout.targetDistanceMi}mi` : ""}
            </h3>
            <span className="text-xs text-neutral-500">{todayWorkout.phase}</span>
          </div>
          <p className="text-sm text-neutral-700 dark:text-neutral-300">{todayWorkout.description}</p>
          {todayWorkout.adjustmentNote && (
            <p className="text-xs italic text-amber-600 dark:text-amber-400 mt-1">{todayWorkout.adjustmentNote}</p>
          )}
          {todayWorkout.activity && (
            <p className="text-xs text-green-700 dark:text-green-400 mt-2">
              Logged: {todayWorkout.activity.distanceMi.toFixed(1)}mi in{" "}
              {Math.round(todayWorkout.activity.movingTimeSec / 60)}min (
              {paceSecPerMiToString(todayWorkout.activity.avgPaceSecPerMi)})
            </p>
          )}
          {todayWorkout.workoutType !== "REST" && todayWorkout.status === "SCHEDULED" && (
            <div className="flex gap-2 mt-3">
              <button
                disabled={updatingId === todayWorkout.id}
                onClick={() => updateWorkout(todayWorkout.id, { status: "COMPLETED" })}
                className="px-3 py-1.5 text-xs font-medium bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded-md disabled:opacity-50"
              >
                Mark completed
              </button>
              <button
                disabled={updatingId === todayWorkout.id}
                onClick={() => updateWorkout(todayWorkout.id, { status: "MISSED" })}
                className="px-3 py-1.5 text-xs font-medium border border-neutral-300 dark:border-neutral-700 rounded-md disabled:opacity-50"
              >
                Mark missed
              </button>
            </div>
          )}
        </div>
      )}

      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">Strava activities</h3>
          {stravaConnected ? (
            <button
              onClick={syncStrava}
              disabled={syncing}
              className="px-3 py-1.5 text-xs font-medium border border-neutral-300 dark:border-neutral-700 rounded-md disabled:opacity-50"
            >
              {syncing ? "Syncing…" : "Sync now"}
            </button>
          ) : (
            <a
              href="/api/strava/authorize"
              className="px-3 py-1.5 text-xs font-medium bg-[#fc4c02] text-white rounded-md"
            >
              Connect Strava
            </a>
          )}
        </div>
        {activities.length === 0 ? (
          <p className="text-sm text-neutral-500">
            {stravaConnected ? "No runs synced yet — hit Sync now." : "Connect Strava to pull in your runs."}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {activities.slice(0, 8).map((a) => (
              <li key={a.id} className="text-sm flex justify-between">
                <span className="text-neutral-700 dark:text-neutral-300">
                  {new Date(a.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })} — {a.name ?? "Run"}
                </span>
                <span className="text-neutral-500">
                  {a.distanceMi.toFixed(1)}mi · {paceSecPerMiToString(a.avgPaceSecPerMi)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
