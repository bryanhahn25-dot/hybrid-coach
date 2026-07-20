import { prisma } from "./prisma";
import { getActivePlan, getRecentActivities } from "./planQueries";
import { paceSecPerMiToString } from "./units";

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d;
}

export async function buildCoachContext(userId: string): Promise<string> {
  const plan = await getActivePlan(userId);
  if (!plan) {
    return "The athlete has no active training plan yet. Encourage them to set one up (goal race, race date, current weekly mileage, long run day) before giving specific workout advice.";
  }

  const weekStart = startOfWeek(new Date());
  const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);

  const [thisWeek, activities] = await Promise.all([
    prisma.plannedWorkout.findMany({
      where: { planId: plan.id, date: { gte: weekStart, lt: weekEnd } },
      orderBy: { date: "asc" },
      include: { activity: true },
    }),
    getRecentActivities(userId, 5),
  ]);

  const lines: string[] = [];
  lines.push(
    `Active plan: "${plan.goalName}" (${plan.goalDistanceMi}mi) on ${plan.raceDate.toDateString()}. Started ${plan.startDate.toDateString()} at ${plan.startingWeeklyMileage}mi/week, long run day: ${plan.longRunDay}.`
  );

  lines.push("This week's schedule:");
  for (const w of thisWeek) {
    const dist = w.targetDistanceMi ? `${w.targetDistanceMi}mi` : "";
    const done = w.activity
      ? ` [ACTUAL: ${w.activity.distanceMi.toFixed(1)}mi in ${Math.round(w.activity.movingTimeSec / 60)}min, avg pace ${paceSecPerMiToString(w.activity.avgPaceSecPerMi)}]`
      : "";
    lines.push(
      `- ${w.date.toDateString()} (${w.phase}, week ${w.weekNumber}) [id ${w.id}]: ${w.workoutType} ${dist} — ${w.description} (status: ${w.status})${w.adjustmentNote ? ` [note: ${w.adjustmentNote}]` : ""}${done}`
    );
  }

  if (activities.length > 0) {
    lines.push("Recently synced Strava activities:");
    for (const a of activities) {
      lines.push(
        `- ${a.date.toDateString()}: ${a.name ?? a.sportType} — ${a.distanceMi.toFixed(1)}mi in ${Math.round(a.movingTimeSec / 60)}min, avg pace ${paceSecPerMiToString(a.avgPaceSecPerMi)}`
      );
    }
  } else {
    lines.push("No Strava activities synced yet.");
  }

  return lines.join("\n");
}
