-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PlanPhase" AS ENUM ('BASE', 'BUILD', 'PEAK', 'TAPER', 'RACE');

-- CreateEnum
CREATE TYPE "WorkoutType" AS ENUM ('EASY', 'LONG', 'TEMPO', 'INTERVALS', 'HILLS', 'RACE_PACE', 'CROSS', 'REST', 'RACE');

-- CreateEnum
CREATE TYPE "WorkoutStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'MISSED', 'ADJUSTED', 'SKIPPED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "measurementPref" TEXT NOT NULL DEFAULT 'imperial',
    "stravaAthleteId" TEXT,
    "stravaAccessToken" TEXT,
    "stravaRefreshToken" TEXT,
    "stravaTokenExpiresAt" TIMESTAMP(3),
    "stravaLastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingPlan" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "goalName" TEXT NOT NULL,
    "goalDistanceMi" DOUBLE PRECISION NOT NULL,
    "raceDate" TIMESTAMP(3) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "startingWeeklyMileage" DOUBLE PRECISION NOT NULL,
    "longRunDay" TEXT NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannedWorkout" (
    "id" SERIAL NOT NULL,
    "planId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "phase" "PlanPhase" NOT NULL,
    "workoutType" "WorkoutType" NOT NULL,
    "targetDistanceMi" DOUBLE PRECISION,
    "targetDurationMin" INTEGER,
    "description" TEXT NOT NULL,
    "status" "WorkoutStatus" NOT NULL DEFAULT 'SCHEDULED',
    "adjustmentNote" TEXT,
    "activityId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlannedWorkout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "stravaId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'strava',
    "name" TEXT,
    "sportType" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "distanceMi" DOUBLE PRECISION NOT NULL,
    "movingTimeSec" INTEGER NOT NULL,
    "elevationGainFt" DOUBLE PRECISION,
    "avgPaceSecPerMi" DOUBLE PRECISION,
    "avgHr" DOUBLE PRECISION,
    "calories" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_stravaAthleteId_key" ON "User"("stravaAthleteId");

-- CreateIndex
CREATE INDEX "TrainingPlan_userId_status_idx" ON "TrainingPlan"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PlannedWorkout_activityId_key" ON "PlannedWorkout"("activityId");

-- CreateIndex
CREATE INDEX "PlannedWorkout_planId_date_idx" ON "PlannedWorkout"("planId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PlannedWorkout_planId_date_key" ON "PlannedWorkout"("planId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_stravaId_key" ON "Activity"("stravaId");

-- CreateIndex
CREATE INDEX "Activity_userId_date_idx" ON "Activity"("userId", "date");

-- CreateIndex
CREATE INDEX "ChatMessage_userId_createdAt_idx" ON "ChatMessage"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "TrainingPlan" ADD CONSTRAINT "TrainingPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedWorkout" ADD CONSTRAINT "PlannedWorkout_planId_fkey" FOREIGN KEY ("planId") REFERENCES "TrainingPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedWorkout" ADD CONSTRAINT "PlannedWorkout_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
