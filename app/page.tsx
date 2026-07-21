import { getCurrentUser } from "@/lib/currentUser";
import {
  getActivePlanWithWorkouts,
  getActivitiesSince,
  getQueuedPlanWithWorkouts,
  getSupportWorkoutsSince,
} from "@/lib/planQueries";
import { getChatHistory } from "@/lib/chatHistory";
import PlanSetupForm from "@/components/PlanSetupForm";
import PlanDashboard, {
  type ActivityView,
  type PlanView,
  type QueuedPlanView,
  type SupportWorkoutView,
  type WorkoutView,
} from "@/components/PlanDashboard";
import CoachChat from "@/components/CoachChat";

// Always reflects live DB state (plan, chat history) — never statically prerendered.
export const dynamic = "force-dynamic";

type WorkoutWithActivity = {
  id: number;
  date: Date;
  weekNumber: number;
  phase: string;
  workoutType: string;
  targetDistanceMi: number | null;
  description: string;
  status: string;
  adjustmentNote: string | null;
  activity: { distanceMi: number; movingTimeSec: number; avgPaceSecPerMi: number | null } | null;
};

function mapWorkout(w: WorkoutWithActivity): WorkoutView {
  return {
    id: w.id,
    date: w.date.toISOString(),
    weekNumber: w.weekNumber,
    phase: w.phase,
    workoutType: w.workoutType,
    targetDistanceMi: w.targetDistanceMi,
    description: w.description,
    status: w.status,
    adjustmentNote: w.adjustmentNote,
    activity: w.activity
      ? {
          distanceMi: w.activity.distanceMi,
          movingTimeSec: w.activity.movingTimeSec,
          avgPaceSecPerMi: w.activity.avgPaceSecPerMi,
        }
      : null,
  };
}

export default async function HomePage() {
  const user = await getCurrentUser();
  const oneYearAgo = new Date(Date.now() - 365 * 86400000);
  const [plan, activities, supportWorkouts, queuedPlan, chatHistory] = await Promise.all([
    getActivePlanWithWorkouts(user.id),
    getActivitiesSince(user.id, oneYearAgo),
    getSupportWorkoutsSince(user.id, oneYearAgo),
    getQueuedPlanWithWorkouts(user.id),
    getChatHistory(user.id),
  ]);

  // The queued plan's workouts are merged in too, so week-navigation can browse forward into
  // it (e.g. the marathon block) before it's actually promoted to active.
  const planView: PlanView | null = plan
    ? {
        id: plan.id,
        goalName: plan.goalName,
        goalDistanceMi: plan.goalDistanceMi,
        raceDate: plan.raceDate.toISOString(),
        startDate: plan.startDate.toISOString(),
        longRunDay: plan.longRunDay,
        workouts: [...plan.workouts.map(mapWorkout), ...(queuedPlan?.workouts.map(mapWorkout) ?? [])],
      }
    : null;

  const activityViews: ActivityView[] = activities.map((a) => ({
    id: a.id,
    name: a.name,
    date: a.date.toISOString(),
    distanceMi: a.distanceMi,
    movingTimeSec: a.movingTimeSec,
    avgPaceSecPerMi: a.avgPaceSecPerMi,
  }));

  const supportWorkoutViews: SupportWorkoutView[] = supportWorkouts.map((s) => ({
    id: s.id,
    date: s.date.toISOString(),
    category: s.category,
    name: s.name,
    description: s.description,
    status: s.status,
  }));

  const queuedPlanView: QueuedPlanView | null = queuedPlan
    ? {
        goalName: queuedPlan.goalName,
        goalDistanceMi: queuedPlan.goalDistanceMi,
        raceDate: queuedPlan.raceDate.toISOString(),
        startDate: queuedPlan.startDate.toISOString(),
      }
    : null;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
      <header className="border-b border-neutral-200 dark:border-neutral-800 px-6 py-4">
        <h1 className="font-bold">Hybrid Coach</h1>
        <p className="text-xs text-neutral-500">Your plan, adapted in real time — not a rigid PDF</p>
      </header>

      <main className="p-6 max-w-6xl mx-auto">
        {!planView ? (
          <PlanSetupForm />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
            <PlanDashboard
              plan={planView}
              activities={activityViews}
              supportWorkouts={supportWorkoutViews}
              queuedPlan={queuedPlanView}
              stravaConnected={!!user.stravaRefreshToken}
            />
            <div className="h-[calc(100vh-140px)] lg:sticky lg:top-6">
              <CoachChat initialMessages={chatHistory} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
