// One-time import of the real training plan (parsed from Google Calendar) into production.
// Run once via the build step, then removed in a follow-up commit -- see reset.sql /
// chat_cleanup.sql for the same pattern used earlier in this project's history.
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(__dirname, "plan_import.json"), "utf-8"));

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUniqueOrThrow({ where: { email: "me@local" } });

  await prisma.trainingPlan.updateMany({
    where: { userId: user.id, status: { in: ["ACTIVE", "QUEUED"] } },
    data: { status: "ARCHIVED" },
  });

  const planIdByKey = {};
  for (const plan of data.plans) {
    const created = await prisma.trainingPlan.create({
      data: {
        userId: user.id,
        goalName: plan.goalName,
        goalDistanceMi: plan.goalDistanceMi,
        raceDate: new Date(plan.raceDate),
        startDate: new Date(plan.startDate),
        startingWeeklyMileage: plan.startingWeeklyMileage,
        longRunDay: plan.longRunDay,
        status: plan.key === "ultra" ? "ACTIVE" : "QUEUED",
      },
    });
    planIdByKey[plan.key] = created.id;
  }

  await prisma.plannedWorkout.createMany({
    data: data.workouts.map((w) => ({
      planId: planIdByKey[w.planKey],
      date: new Date(w.date),
      weekNumber: w.weekNumber,
      phase: w.phase,
      workoutType: w.workoutType,
      targetDistanceMi: w.targetDistanceMi,
      description: w.description,
    })),
  });

  await prisma.supportWorkout.createMany({
    data: data.support.map((s) => ({
      userId: user.id,
      date: new Date(s.date),
      category: s.category,
      name: s.name,
      description: s.description,
    })),
  });

  console.log(
    `Imported ${data.plans.length} plans, ${data.workouts.length} workouts, ${data.support.length} support workouts.`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
