"use client";

import { useEffect, useState } from "react";
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

export interface SupportWorkoutView {
  id: number;
  date: string;
  category: "STRENGTH" | "MOBILITY";
  name: string;
  description: string | null;
  status: string;
}

export interface QueuedPlanView {
  goalName: string;
  goalDistanceMi: number;
  raceDate: string;
  startDate: string;
}

const STATUS_STYLES: Record<string, string> = {
  SCHEDULED: "border-neutral-300 dark:border-neutral-700",
  COMPLETED: "border-green-500 bg-green-50 dark:bg-green-950",
  MISSED: "border-red-400 bg-red-50 dark:bg-red-950",
  ADJUSTED: "border-amber-400 bg-amber-50 dark:bg-amber-950",
  SKIPPED: "border-neutral-300 dark:border-neutral-700 opacity-60",
};

// Workout/activity/support dates are stored as UTC-midnight markers representing a calendar day
// (matching the convention used server-side, e.g. lib/strava.ts's startOfLocalDay). Comparing or
// displaying them with local-timezone Date methods shifts them a day for any browser west of UTC,
// so everything here operates on UTC components instead.
function isSameDay(a: Date, b: Date) {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

function startOfWeek(d: Date) {
  const s = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  s.setUTCDate(s.getUTCDate() - s.getUTCDay());
  return s;
}

/** Today's calendar date (in the browser's local sense) represented the same UTC-midnight way. */
function todayAsUTCMarker() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

function formatUTCDate(d: Date, opts: Intl.DateTimeFormatOptions) {
  return d.toLocaleDateString(undefined, { ...opts, timeZone: "UTC" });
}

export default function PlanDashboard({
  plan,
  activities,
  supportWorkouts,
  queuedPlan,
  stravaConnected,
}: {
  plan: PlanView;
  activities: ActivityView[];
  supportWorkouts: SupportWorkoutView[];
  queuedPlan: QueuedPlanView | null;
  stravaConnected: boolean;
}) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [updatingSupportId, setUpdatingSupportId] = useState<number | null>(null);

  const today = todayAsUTCMarker();
  const thisWeekStart = startOfWeek(today);
  const [weekStart, setWeekStart] = useState(thisWeekStart);

  const raceDate = new Date(plan.raceDate);
  const daysToRace = Math.ceil((raceDate.getTime() - today.getTime()) / 86400000);

  // Bound navigation to roughly a year of history (matches how far back activities are fetched)
  // through a week past the furthest-out race (including a queued plan), so the arrows can't
  // scroll into a guaranteed-empty void.
  const furthestRaceDate = queuedPlan && new Date(queuedPlan.raceDate) > raceDate ? new Date(queuedPlan.raceDate) : raceDate;
  const earliestWeek = startOfWeek(new Date(today.getTime() - 365 * 86400000));
  const latestWeek = startOfWeek(new Date(furthestRaceDate.getTime() + 7 * 86400000));
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
  const weekSupport = weekDays.map((day) => supportWorkouts.filter((s) => isSameDay(new Date(s.date), day)));
  const isViewingCurrentWeek = isSameDay(weekStart, thisWeekStart);
  const todayWorkout = plan.workouts.find((w) => isSameDay(new Date(w.date), today));

  const [selectedWorkoutId, setSelectedWorkoutId] = useState<number | null>(todayWorkout?.id ?? null);
  // Clicking a day selects its workout for the detail panel below; jumping to a different week
  // clears that selection (defaulting back to today's workout if the current week is in view).
  useEffect(() => {
    setSelectedWorkoutId(isViewingCurrentWeek ? (todayWorkout?.id ?? null) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart.getTime()]);
  const selectedWorkout = plan.workouts.find((w) => w.id === selectedWorkoutId);
  const isSelectedToday = !!selectedWorkout && isSameDay(new Date(selectedWorkout.date), today);

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

  async function updateSupportWorkout(id: number, status: string) {
    setUpdatingSupportId(id);
    try {
      await fetch(`/api/support-workouts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      router.refresh();
    } finally {
      setUpdatingSupportId(null);
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
            {plan.goalDistanceMi}mi on{" "}
            {formatUTCDate(raceDate, { weekday: "short", month: "short", day: "numeric", year: "numeric" })} ·{" "}
            {daysToRace >= 0 ? `${daysToRace} days out` : "raced"}
          </p>
        </div>
      </div>

      {queuedPlan && (
        <div className="rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 p-3 text-sm text-neutral-600 dark:text-neutral-400">
          Next up: <span className="font-medium text-neutral-900 dark:text-neutral-100">{queuedPlan.goalName}</span> (
          {queuedPlan.goalDistanceMi}mi) — training starts{" "}
          {formatUTCDate(new Date(queuedPlan.startDate), { month: "short", day: "numeric", year: "numeric" })}, racing{" "}
          {formatUTCDate(new Date(queuedPlan.raceDate), { month: "short", day: "numeric", year: "numeric" })}. It'll
          automatically become your active plan once {plan.goalName} is done.
        </div>
      )}

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
            {formatUTCDate(weekDays[0], { month: "short", day: "numeric" })} –{" "}
            {formatUTCDate(weekDays[6], { month: "short", day: "numeric", year: "numeric" })}
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
          const support = weekSupport[i];
          const isToday = isSameDay(day, today);
          const isSelected = w && w.id === selectedWorkoutId;
          const cellStyle = w
            ? STATUS_STYLES[w.status]
            : a
              ? "border-blue-300 bg-blue-50 dark:bg-blue-950 dark:border-blue-800"
              : "border-neutral-200 dark:border-neutral-800";
          const ringStyle = isSelected
            ? "ring-2 ring-blue-600"
            : isToday
              ? "ring-2 ring-neutral-900 dark:ring-white"
              : "";
          return (
            <button
              type="button"
              key={i}
              disabled={!w}
              onClick={() => w && setSelectedWorkoutId(w.id)}
              className={`rounded-lg border p-2 text-center ${cellStyle} ${ringStyle} ${w ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
            >
              <div className="text-[10px] uppercase text-neutral-500">
                {formatUTCDate(day, { weekday: "short" })} {day.getUTCDate()}
              </div>
              <div className="text-xs font-medium mt-0.5">{w ? w.workoutType : a ? "Run" : "—"}</div>
              <div className="text-[11px] text-neutral-500">{w?.targetDistanceMi ? `${w.targetDistanceMi}mi` : ""}</div>
              {a && (
                <div className="text-[11px] text-green-700 dark:text-green-400 mt-0.5">{a.distanceMi.toFixed(1)}mi actual</div>
              )}
              {support.length > 0 && (
                <div className="text-[11px] mt-0.5" title={support.map((s) => s.name).join(", ")}>
                  {support.some((s) => s.category === "STRENGTH") ? "💪" : ""}
                  {support.some((s) => s.category === "MOBILITY") ? "🧘" : ""}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {weekSupport.some((day) => day.length > 0) && (
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
          <h3 className="font-semibold text-sm mb-3">Strength &amp; mobility this week</h3>
          <ul className="space-y-2">
            {weekDays.flatMap((day, i) =>
              weekSupport[i].map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <span className="text-neutral-500 text-xs">{formatUTCDate(day, { weekday: "short" })} </span>
                    <span
                      className={`text-neutral-700 dark:text-neutral-300 ${s.status === "COMPLETED" ? "line-through opacity-60" : ""}`}
                    >
                      {s.category === "STRENGTH" ? "💪" : "🧘"} {s.name}
                    </span>
                  </div>
                  {s.status === "SCHEDULED" && (
                    <button
                      disabled={updatingSupportId === s.id}
                      onClick={() => updateSupportWorkout(s.id, "COMPLETED")}
                      className="shrink-0 px-2 py-1 text-xs font-medium border border-neutral-300 dark:border-neutral-700 rounded-md disabled:opacity-50"
                    >
                      Done
                    </button>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      )}

      {selectedWorkout && (
        <div className="rounded-lg border border-blue-200 dark:border-blue-900 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">
              {isSelectedToday ? "Today" : formatUTCDate(new Date(selectedWorkout.date), { weekday: "short", month: "short", day: "numeric" })}{" "}
              — {selectedWorkout.workoutType}
              {selectedWorkout.targetDistanceMi ? ` · ${selectedWorkout.targetDistanceMi}mi` : ""}
            </h3>
            <span className="text-xs text-neutral-500">{selectedWorkout.phase}</span>
          </div>
          <p className="text-sm text-neutral-700 dark:text-neutral-300">{selectedWorkout.description}</p>
          {selectedWorkout.adjustmentNote && (
            <p className="text-xs italic text-amber-600 dark:text-amber-400 mt-1">{selectedWorkout.adjustmentNote}</p>
          )}
          {selectedWorkout.activity && (
            <p className="text-xs text-green-700 dark:text-green-400 mt-2">
              Logged: {selectedWorkout.activity.distanceMi.toFixed(1)}mi in{" "}
              {Math.round(selectedWorkout.activity.movingTimeSec / 60)}min (
              {paceSecPerMiToString(selectedWorkout.activity.avgPaceSecPerMi)})
            </p>
          )}
          {selectedWorkout.workoutType !== "REST" && selectedWorkout.status === "SCHEDULED" && (
            <div className="flex gap-2 mt-3">
              <button
                disabled={updatingId === selectedWorkout.id}
                onClick={() => updateWorkout(selectedWorkout.id, { status: "COMPLETED" })}
                className="px-3 py-1.5 text-xs font-medium bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded-md disabled:opacity-50"
              >
                Mark completed
              </button>
              <button
                disabled={updatingId === selectedWorkout.id}
                onClick={() => updateWorkout(selectedWorkout.id, { status: "MISSED" })}
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
