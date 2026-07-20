import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import { ensureFreshAccessToken, fetchActivitiesSince } from "@/lib/strava";
import { metersToMiles, metersToFeet, metersPerSecondToPaceSecPerMi } from "@/lib/units";

const RUN_SPORT_TYPES = new Set(["Run", "TrailRun", "VirtualRun"]);
const DEFAULT_LOOKBACK_DAYS = 90;

function startOfLocalDay(isoLocal: string): Date {
  // Strava's start_date_local has no timezone offset; treat the date portion as-is.
  const [datePart] = isoLocal.split("T");
  return new Date(`${datePart}T00:00:00.000Z`);
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user.stravaRefreshToken) {
    return NextResponse.json({ error: "Strava is not connected yet" }, { status: 400 });
  }

  const accessToken = await ensureFreshAccessToken(user);
  const since = user.stravaLastSyncAt ?? new Date(Date.now() - DEFAULT_LOOKBACK_DAYS * 86400000);
  const afterUnixSeconds = Math.floor(since.getTime() / 1000);

  const activities = (await fetchActivitiesSince(accessToken, afterUnixSeconds)).filter((a) =>
    RUN_SPORT_TYPES.has(a.sport_type)
  );

  let imported = 0;
  let linked = 0;

  for (const activity of activities) {
    const record = await prisma.activity.upsert({
      where: { stravaId: String(activity.id) },
      create: {
        userId: user.id,
        stravaId: String(activity.id),
        source: "strava",
        name: activity.name,
        sportType: activity.sport_type,
        date: new Date(activity.start_date),
        distanceMi: metersToMiles(activity.distance),
        movingTimeSec: activity.moving_time,
        elevationGainFt: metersToFeet(activity.total_elevation_gain ?? 0),
        avgPaceSecPerMi: metersPerSecondToPaceSecPerMi(activity.average_speed),
        avgHr: activity.average_heartrate,
        calories: activity.calories,
      },
      update: {
        name: activity.name,
        distanceMi: metersToMiles(activity.distance),
        movingTimeSec: activity.moving_time,
        elevationGainFt: metersToFeet(activity.total_elevation_gain ?? 0),
        avgPaceSecPerMi: metersPerSecondToPaceSecPerMi(activity.average_speed),
        avgHr: activity.average_heartrate,
        calories: activity.calories,
      },
    });
    imported += 1;

    const dayStart = startOfLocalDay(activity.start_date_local ?? activity.start_date);
    const dayEnd = new Date(dayStart.getTime() + 86400000);

    const matchingWorkout = await prisma.plannedWorkout.findFirst({
      where: {
        plan: { userId: user.id, status: "ACTIVE" },
        date: { gte: dayStart, lt: dayEnd },
        workoutType: { notIn: ["REST"] },
        activityId: null,
      },
    });

    if (matchingWorkout) {
      await prisma.plannedWorkout.update({
        where: { id: matchingWorkout.id },
        data: { activityId: record.id, status: "COMPLETED" },
      });
      linked += 1;
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { stravaLastSyncAt: new Date() },
  });

  return NextResponse.json({ imported, linked });
}
