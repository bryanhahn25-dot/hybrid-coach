"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const DISTANCE_PRESETS = [
  { label: "5K", miles: 3.1 },
  { label: "10K", miles: 6.2 },
  { label: "Half Marathon", miles: 13.1 },
  { label: "Marathon", miles: 26.2 },
  { label: "50K", miles: 31 },
  { label: "50 Mile", miles: 50 },
  { label: "100K", miles: 62 },
  { label: "100 Mile", miles: 100 },
];

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function PlanSetupForm() {
  const router = useRouter();
  const [goalName, setGoalName] = useState("");
  const [goalDistanceMi, setGoalDistanceMi] = useState(26.2);
  const [raceDate, setRaceDate] = useState("");
  const [startingWeeklyMileage, setStartingWeeklyMileage] = useState(20);
  const [longRunDay, setLongRunDay] = useState("Saturday");
  const [daysPerWeek, setDaysPerWeek] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/plan/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goalName: goalName || `${goalDistanceMi}mi race`,
          goalDistanceMi,
          raceDate,
          startingWeeklyMileage,
          longRunDay,
          daysPerWeek,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ? JSON.stringify(body.error) : "Failed to generate plan");
      }
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="max-w-lg mx-auto bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-6 space-y-4"
    >
      <div>
        <h2 className="text-lg font-semibold">Set up your training plan</h2>
        <p className="text-sm text-neutral-500">
          Generates a periodized plan (base → build → peak → taper) you can adjust anytime via chat.
        </p>
      </div>

      <div>
        <label className="text-sm font-medium block mb-1">Race name</label>
        <input
          className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-700 rounded-md bg-transparent"
          value={goalName}
          onChange={(e) => setGoalName(e.target.value)}
          placeholder="e.g. Fall 50 Miler"
        />
      </div>

      <div>
        <label className="text-sm font-medium block mb-1">Distance</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {DISTANCE_PRESETS.map((p) => (
            <button
              type="button"
              key={p.label}
              onClick={() => setGoalDistanceMi(p.miles)}
              className={`px-2.5 py-1 text-xs rounded-full border ${
                goalDistanceMi === p.miles
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-neutral-900 dark:border-white"
                  : "border-neutral-300 dark:border-neutral-700"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <input
          type="number"
          step="0.1"
          min="1"
          className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-700 rounded-md bg-transparent"
          value={goalDistanceMi}
          onChange={(e) => setGoalDistanceMi(Number(e.target.value))}
        />
      </div>

      <div>
        <label className="text-sm font-medium block mb-1">Race date</label>
        <input
          type="date"
          required
          className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-700 rounded-md bg-transparent"
          value={raceDate}
          onChange={(e) => setRaceDate(e.target.value)}
        />
      </div>

      <div>
        <label className="text-sm font-medium block mb-1">Current weekly mileage</label>
        <input
          type="number"
          min="0"
          className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-700 rounded-md bg-transparent"
          value={startingWeeklyMileage}
          onChange={(e) => setStartingWeeklyMileage(Number(e.target.value))}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium block mb-1">Long run day</label>
          <select
            className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-700 rounded-md bg-transparent"
            value={longRunDay}
            onChange={(e) => setLongRunDay(e.target.value)}
          >
            {DAYS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Run days / week</label>
          <select
            className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-700 rounded-md bg-transparent"
            value={daysPerWeek}
            onChange={(e) => setDaysPerWeek(Number(e.target.value))}
          >
            {[3, 4, 5, 6, 7].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-2.5 text-sm font-medium bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded-md disabled:opacity-50"
      >
        {submitting ? "Generating…" : "Generate plan"}
      </button>
    </form>
  );
}
