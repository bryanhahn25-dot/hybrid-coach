import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";

const bodySchema = z.object({
  status: z.enum(["SCHEDULED", "COMPLETED", "MISSED", "ADJUSTED", "SKIPPED"]),
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
  const workout = await prisma.supportWorkout.findFirst({
    where: { id: workoutId, userId: user.id },
  });
  if (!workout) {
    return NextResponse.json({ error: "Workout not found" }, { status: 404 });
  }

  const updated = await prisma.supportWorkout.update({
    where: { id: workoutId },
    data: parsed.data,
  });

  return NextResponse.json({ workout: updated });
}
