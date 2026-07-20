import { prisma } from "./prisma";

export function getActivePlan(userId: string) {
  return prisma.trainingPlan.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });
}

export function getActivePlanWithWorkouts(userId: string) {
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
