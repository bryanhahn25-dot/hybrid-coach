-- Dedupe SupportWorkout rows created by an accidental duplicate import run (an earlier build
-- re-ran the one-time calendar import), keeping the earliest copy of each.
DELETE FROM "SupportWorkout" a
USING "SupportWorkout" b
WHERE a.id > b.id
  AND a."userId" = b."userId"
  AND a."date" = b."date"
  AND a."name" = b."name";

-- AlterTable
ALTER TABLE "SupportWorkout" ADD CONSTRAINT "SupportWorkout_userId_date_name_key" UNIQUE ("userId", "date", "name");

-- Clean up duplicate archived copies of the imported plan from the same accidental re-run.
DELETE FROM "PlannedWorkout"
WHERE "planId" IN (
  SELECT id FROM "TrainingPlan"
  WHERE status = 'ARCHIVED' AND "goalName" IN ('50-Mile Ultra', 'Marathon')
);

DELETE FROM "TrainingPlan"
WHERE status = 'ARCHIVED' AND "goalName" IN ('50-Mile Ultra', 'Marathon');
