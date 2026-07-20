import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/currentUser";
import { getActivePlanWithWorkouts } from "@/lib/planQueries";

export async function GET() {
  const user = await getCurrentUser();
  const plan = await getActivePlanWithWorkouts(user.id);
  return NextResponse.json({ plan });
}
