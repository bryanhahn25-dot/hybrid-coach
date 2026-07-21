import { prisma } from "./prisma";

/**
 * If the active plan's race has already happened and the athlete has a queued plan lined up
 * (e.g. an ultra build followed by a marathon build), promote the earliest queued plan to
 * active and retire the finished one. No-op if there's nothing to transition.
 */
async function promoteQueuedPlanIfDue(userId: string) {
  const active = await prisma.trainingPlan.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });
  if (!active || active.raceDate.getTime() >= Date.now()) return;

  const next = await prisma.trainingPlan.findFirst({
    where: { userId, status: "QUEUED" },
    orderBy: { startDate: "asc" },
  });
  if (!next) return;

  await prisma.$transaction([
    prisma.trainingPlan.update({ where: { id: active.id }, data: { status: "COMPLETED" } }),
    prisma.trainingPlan.update({ where: { id: next.id }, data: { status: "ACTIVE" } }),
  ]);
}

export async function getActivePlan(userId: string) {
  await promoteQueuedPlanIfDue(userId);
  return prisma.trainingPlan.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });
}

export async function getActivePlanWithWorkouts(userId: string) {
  await promoteQueuedPlanIfDue(userId);
  return prisma.trainingPlan.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    include: {
      workouts: {
        orderBy: { date: "asc" },
        include: { activity: true },
      },
    },
  });
}

/**
 * The next queued plan (if any) with its workouts, so the UI can show what's coming up after the
 * current race and let week-navigation browse into it before it's actually active.
 */
export function getQueuedPlanWithWorkouts(userId: string) {
  return prisma.trainingPlan.findFirst({
    where: { userId, status: "QUEUED" },
    orderBy: { startDate: "asc" },
    include: {
      workouts: {
        orderBy: { date: "asc" },
        include: { activity: true },
      },
    },
  });
}

export function getWorkoutsInRange(planId: number, from: Date, to: Date) {
  return prisma.plannedWorkout.findMany({
    where: { planId, date: { gte: from, lte: to } },
    orderBy: { date: "asc" },
    include: { activity: true },
  });
}

export function getRecentActivities(userId: string, limit = 10) {
  return prisma.activity.findMany({
    where: { userId },
    orderBy: { date: "desc" },
    take: limit,
  });
}

/** All activities since `since`, for week-by-week browsing (including pre-plan history). */
export function getActivitiesSince(userId: string, since: Date) {
  return prisma.activity.findMany({
    where: { userId, date: { gte: since } },
    orderBy: { date: "desc" },
  });
}

/** Strength + mobility entries since `since`, for week-by-week browsing alongside the running plan. */
export function getSupportWorkoutsSince(userId: string, since: Date) {
  return prisma.supportWorkout.findMany({
    where: { userId, date: { gte: since } },
    orderBy: { date: "asc" },
  });
}
