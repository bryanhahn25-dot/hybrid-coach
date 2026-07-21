-- CreateEnum
CREATE TYPE "SupportCategory" AS ENUM ('STRENGTH', 'MOBILITY');

-- CreateTable
CREATE TABLE "SupportWorkout" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "category" "SupportCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "WorkoutStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportWorkout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportWorkout_userId_date_idx" ON "SupportWorkout"("userId", "date");

-- AddForeignKey
ALTER TABLE "SupportWorkout" ADD CONSTRAINT "SupportWorkout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
