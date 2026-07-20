import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";

const bodySchema = z.object({
  status: z.enum(["SCHEDULED", "COMPLETED", "MISSED", "ADJUSTED", "SKIPPED"]).optional(),
  workoutType: z
    .enum(["EASY", "LONG", "TEMPO", "INTERVALS", "HILLS", "RACE_PACE", "CROSS", "REST", "RACE"])
    .optional(),
  targetDistanceMi: z.number().min(0).max(150).nullable().optional(),
  targetDurationMin: z.number().int().min(0).max(2000).nullable().optional(),
  description: z.string().min(1).max(500).optional(),
  adjustmentNote: z.string().max(1000).nullable().optional(),
  date: z.coerce.date().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const workoutId = Number(id);
  if (!Number.isInteger(workoutId)) {
    return NextResponse.json({ error: "Invalid workout id" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const user = await getCurrentUser();
  const workout = await prisma.plannedWorkout.findFirst({
    where: { id: workoutId, plan: { userId: user.id } },
  });
  if (!workout) {
    return NextResponse.json({ error: "Workout not found" }, { status: 404 });
  }

  const updated = await prisma.plannedWorkout.update({
    where: { id: workoutId },
    data: parsed.data,
  });

  return NextResponse.json({ workout: updated });
}
