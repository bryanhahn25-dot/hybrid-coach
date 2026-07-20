// Rule-based periodized training plan generator. Not ML, not Runna's black
// box -- a transparent progression (base -> build -> peak -> taper -> race)
// that the coach chat can explain and adjust. Handles road races and ultras
// (50k+), where long runs cap out and back-to-back long days do the rest of
// the work instead of one ever-growing single run.

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

type Role = "LONG" | "LONG2" | "QUALITY" | "EASY" | "REST";
type Phase = "BASE" | "BUILD" | "PEAK" | "TAPER" | "RACE";
type QualityWorkoutType = "TEMPO" | "INTERVALS" | "HILLS" | "RACE_PACE";
export type WorkoutType = QualityWorkoutType | "EASY" | "LONG" | "REST" | "RACE";

export interface PlanInput {
  goalName: string;
  goalDistanceMi: number;
  raceDate: Date;
  startDate: Date;
  startingWeeklyMileage: number;
  longRunDay: string; // e.g. "Saturday"
  daysPerWeek?: number; // default 5
}

export interface GeneratedWorkout {
  date: Date;
  weekNumber: number;
  phase: Phase;
  workoutType: WorkoutType;
  targetDistanceMi: number | null;
  description: string;
}

function dayIndex(name: string): number {
  const idx = DAY_NAMES.findIndex((d) => d.toLowerCase() === name.toLowerCase());
  if (idx === -1) throw new Error(`Unknown day of week: ${name}`);
  return idx;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function roundHalf(n: number) {
  return Math.round(n * 2) / 2;
}

/** Fixed day-of-week roles used for every week of the plan. */
function buildWeekTemplate(longRunDay: string, daysPerWeek: number, isUltra: boolean): Role[] {
  const roles: (Role | null)[] = Array(7).fill(null);
  const L = dayIndex(longRunDay);
  roles[L] = "LONG";

  if (isUltra && daysPerWeek >= 5) {
    roles[(L + 1) % 7] = "LONG2";
  }

  const restCount = Math.max(0, 7 - daysPerWeek);
  const restDays: number[] = [];
  const preRest = (L + 6) % 7;
  if (roles[preRest] === null) restDays.push(preRest);
  for (let i = 0; i < 7 && restDays.length < restCount; i++) {
    const idx = (L + 3 + i) % 7;
    if (roles[idx] === null && !restDays.includes(idx)) restDays.push(idx);
  }
  restDays.slice(0, restCount).forEach((idx) => (roles[idx] = "REST"));

  const qIdx = (L + 4) % 7;
  if (roles[qIdx] === null) {
    roles[qIdx] = "QUALITY";
  } else {
    for (let off = 1; off < 7; off++) {
      const a = (qIdx + off) % 7;
      const b = (qIdx - off + 7) % 7;
      if (roles[a] === null) {
        roles[a] = "QUALITY";
        break;
      }
      if (roles[b] === null) {
        roles[b] = "QUALITY";
        break;
      }
    }
  }

  for (let i = 0; i < 7; i++) if (roles[i] === null) roles[i] = "EASY";
  return roles as Role[];
}

function computePhaseWeeks(totalWeeks: number) {
  const taperWeeks = totalWeeks <= 3 ? 1 : totalWeeks <= 8 ? 2 : 3;
  const peakWeeks = totalWeeks <= 3 ? 0 : Math.max(1, Math.round(totalWeeks * 0.12));
  const buildWeeksRaw = totalWeeks <= 3 ? 0 : Math.round(totalWeeks * 0.35);
  const baseWeeks = Math.max(0, totalWeeks - taperWeeks - peakWeeks - buildWeeksRaw);
  const buildWeeks = Math.max(0, totalWeeks - taperWeeks - peakWeeks - baseWeeks);
  return { baseWeeks, buildWeeks, peakWeeks, taperWeeks };
}

function phaseForWeek(weekIdx: number, totalWeeks: number): Phase {
  if (weekIdx === totalWeeks - 1) return "RACE";
  const { baseWeeks, buildWeeks, peakWeeks } = computePhaseWeeks(totalWeeks);
  if (weekIdx < baseWeeks) return "BASE";
  if (weekIdx < baseWeeks + buildWeeks) return "BUILD";
  if (weekIdx < baseWeeks + buildWeeks + peakWeeks) return "PEAK";
  return "TAPER";
}

// Builds the "ramp" -- a monotonically non-decreasing baseline through base/build/peak,
// independent of cutback weeks -- then applies cutback dips and taper on top of it. Cutback
// weeks dip *from* the ramp rather than compounding off the previous (already-reduced) week,
// so a string of recovery weeks can't erase the overall progression.
function computeWeeklyMileageTargets(totalWeeks: number, startingWeeklyMileage: number): number[] {
  const { baseWeeks, buildWeeks, peakWeeks } = computePhaseWeeks(totalWeeks);
  const rampWeeks = Math.max(1, baseWeeks + buildWeeks + peakWeeks - 1);
  const growthFactor = Math.min(1.6, 1 + 0.05 * rampWeeks); // capped, safe overall increase
  const peakMileage = startingWeeklyMileage * growthFactor;

  const targets: number[] = [];
  for (let i = 0; i < totalWeeks; i++) {
    const phase = phaseForWeek(i, totalWeeks);
    let ramp: number;

    if (phase === "RACE") {
      ramp = startingWeeklyMileage * 0.15;
    } else if (phase === "TAPER") {
      const weeksToRace = totalWeeks - 1 - i;
      const taperFactor = weeksToRace <= 1 ? 0.5 : weeksToRace === 2 ? 0.65 : 0.8;
      ramp = peakMileage * taperFactor;
    } else {
      const t = Math.min(i, rampWeeks) / rampWeeks;
      ramp = startingWeeklyMileage + (peakMileage - startingWeeklyMileage) * t;
    }

    const isCutbackWeek = phase !== "RACE" && phase !== "TAPER" && (i + 1) % 4 === 0;
    const value = isCutbackWeek ? ramp * 0.8 : ramp;
    targets.push(Math.round(value * 10) / 10);
  }
  return targets;
}

function qualityPlan(phase: Phase, weekIdx: number): { type: QualityWorkoutType; label: string } {
  switch (phase) {
    case "TAPER":
    case "RACE":
      return { type: "TEMPO", label: "Tempo — short, with race-pace strides" };
    case "PEAK":
      return weekIdx % 2 === 0
        ? { type: "RACE_PACE", label: "Race-pace intervals" }
        : { type: "INTERVALS", label: "Intervals — VO2 max repeats" };
    case "BUILD":
      return weekIdx % 2 === 0
        ? { type: "TEMPO", label: "Tempo run — sustained threshold effort" }
        : { type: "INTERVALS", label: "Intervals — threshold repeats" };
    default:
      return weekIdx % 3 === 0
        ? { type: "HILLS", label: "Hill repeats — strength & form" }
        : { type: "TEMPO", label: "Steady tempo — comfortably hard" };
  }
}

export function generatePlan(input: PlanInput): GeneratedWorkout[] {
  const daysPerWeek = input.daysPerWeek ?? 5;
  const isUltra = input.goalDistanceMi > 26.5;

  const start = new Date(input.startDate);
  start.setHours(0, 0, 0, 0);
  const race = new Date(input.raceDate);
  race.setHours(0, 0, 0, 0);

  const totalDays = Math.round((race.getTime() - start.getTime()) / 86400000) + 1;
  if (totalDays < 1) throw new Error("Race date must be on or after the start date");
  const totalWeeks = Math.max(1, Math.ceil(totalDays / 7));

  const template = buildWeekTemplate(input.longRunDay, daysPerWeek, isUltra);
  const weeklyMileage = computeWeeklyMileageTargets(totalWeeks, input.startingWeeklyMileage);
  const longRunCapMi =
    input.goalDistanceMi <= 15 ? input.goalDistanceMi * 1.1 : input.goalDistanceMi <= 27 ? 22 : 30;
  const easyDayCount = template.filter((r) => r === "EASY").length || 1;

  const workouts: GeneratedWorkout[] = [];

  for (let d = 0; d < totalDays; d++) {
    const date = new Date(start.getTime() + d * 86400000);
    const weekIdx = clamp(Math.floor(d / 7), 0, totalWeeks - 1);
    const weekNumber = weekIdx + 1;
    const isRaceDay = d === totalDays - 1;
    const weeklyTarget = weeklyMileage[weekIdx];

    if (isRaceDay) {
      workouts.push({
        date,
        weekNumber,
        phase: "RACE",
        workoutType: "RACE",
        targetDistanceMi: Math.round(input.goalDistanceMi * 10) / 10,
        description: `${input.goalName} — race day. Target: ${input.goalDistanceMi}mi.`,
      });
      continue;
    }

    const phase = phaseForWeek(weekIdx, totalWeeks);
    let role = template[date.getDay()];
    if (d === totalDays - 2) role = "REST"; // always rest the day before race
    if (phase === "BASE" && role === "LONG2") role = "EASY"; // no back-to-backs until base is built

    const longMi = roundHalf(clamp(weeklyTarget * 0.4, 3, longRunCapMi));

    if (role === "REST") {
      workouts.push({
        date,
        weekNumber,
        phase,
        workoutType: "REST",
        targetDistanceMi: null,
        description: "Rest day — recovery",
      });
    } else if (role === "LONG") {
      workouts.push({
        date,
        weekNumber,
        phase,
        workoutType: "LONG",
        targetDistanceMi: longMi,
        description: isUltra
          ? `Long run — ${longMi}mi at an easy, conversational effort`
          : `Long run — ${longMi}mi, build endurance`,
      });
    } else if (role === "LONG2") {
      const long2Mi = roundHalf(clamp(longMi * 0.55, 3, longRunCapMi * 0.7));
      workouts.push({
        date,
        weekNumber,
        phase,
        workoutType: "LONG",
        targetDistanceMi: long2Mi,
        description: `Back-to-back long run — ${long2Mi}mi on tired legs (ultra specificity)`,
      });
    } else if (role === "QUALITY") {
      const q = qualityPlan(phase, weekIdx);
      const qMi = roundHalf(clamp(weeklyTarget * 0.15, 3, isUltra ? 9 : 8));
      workouts.push({
        date,
        weekNumber,
        phase,
        workoutType: q.type,
        targetDistanceMi: qMi,
        description: `${q.label} — ${qMi}mi total`,
      });
    } else {
      const hasLong2 = template.includes("LONG2") && phase !== "BASE";
      const long2Mi = hasLong2 ? roundHalf(clamp(longMi * 0.55, 3, longRunCapMi * 0.7)) : 0;
      const qMi = roundHalf(clamp(weeklyTarget * 0.15, 3, isUltra ? 9 : 8));
      const remaining = Math.max(weeklyTarget - longMi - long2Mi - qMi, easyDayCount * 2.5);
      const easyMi = roundHalf(clamp(remaining / easyDayCount, 2.5, 12));
      workouts.push({
        date,
        weekNumber,
        phase,
        workoutType: "EASY",
        targetDistanceMi: easyMi,
        description: `Easy run — ${easyMi}mi, conversational pace`,
      });
    }
  }

  return workouts;
}
