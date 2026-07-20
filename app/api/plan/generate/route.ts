import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import { generatePlan } from "@/lib/planGenerator";

const bodySchema = z.object({
  goalName: z.string().min(1).max(120),
  goalDistanceMi: z.number().positive().max(250),
  raceDate: z.coerce.date(),
  startDate: z.coerce.date().optional(),
  startingWeeklyMileage: z.number().min(0).max(200),
  longRunDay: z.string().min(1),
  daysPerWeek: z.number().int().min(3).max(7).optional(),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;
  const startDate = input.startDate ?? new Date();

  if (input.raceDate.getTime() < startDate.getTime()) {
    return NextResponse.json({ error: "raceDate must be on or after startDate" }, { status: 400 });
  }

  const user = await getCurrentUser();

  const workouts = generatePlan({
    goalName: input.goalName,
    goalDistanceMi: input.goalDistanceMi,
    raceDate: input.raceDate,
    startDate,
    startingWeeklyMileage: input.startingWeeklyMileage,
    longRunDay: input.longRunDay,
    daysPerWeek: input.daysPerWeek,
  });

  const plan = await prisma.$transaction(async (tx) => {
    await tx.trainingPlan.updateMany({
      where: { userId: user.id, status: "ACTIVE" },
      data: { status: "ARCHIVED" },
    });

    const created = await tx.trainingPlan.create({
      data: {
        userId: user.id,
        goalName: input.goalName,
        goalDistanceMi: input.goalDistanceMi,
        raceDate: input.raceDate,
        startDate,
        startingWeeklyMileage: input.startingWeeklyMileage,
        longRunDay: input.longRunDay,
        status: "ACTIVE",
      },
    });

    await tx.plannedWorkout.createMany({
      data: workouts.map((w) => ({
        planId: created.id,
        date: w.date,
        weekNumber: w.weekNumber,
        phase: w.phase,
        workoutType: w.workoutType,
        targetDistanceMi: w.targetDistanceMi,
        description: w.description,
      })),
    });

    return tx.trainingPlan.findUniqueOrThrow({
      where: { id: created.id },
      include: { workouts: { orderBy: { date: "asc" } } },
    });
  });

  return NextResponse.json({ plan });
}
