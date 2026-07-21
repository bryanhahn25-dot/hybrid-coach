import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText, convertToModelMessages, tool, stepCountIs, type UIMessage } from "ai";
import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import { buildCoachContext } from "@/lib/chatContext";
import { getChatHistory } from "@/lib/chatHistory";

export const maxDuration = 30;

function textFromUIMessage(message: UIMessage): string {
  return message.parts
    .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join("\n");
}

const SYSTEM_PROMPT = `You are an adaptive running coach. Unlike a rigid pre-baked plan (Runna), you can see the athlete's actual training plan and their real Strava activity data, and you actively adjust the plan when life happens -- illness, fatigue, travel, a missed session, unexpected soreness. Favor the athlete's long-term consistency and health over blind adherence to the schedule.

When the athlete reports something that should change today's or this week's training (sick, sore, exhausted, traveling, time-crunched, feeling great and wants more), use the adjustWorkouts tool to actually update the plan -- don't just suggest it in prose. Use getWorkouts if you need to see a date range beyond this week (e.g. "what does next month look like"). Always explain briefly why you made the change.

Keep responses concise and direct, like a real coach texting back.`;

const google = createGoogleGenerativeAI({ apiKey: process.env.Gemini_API_Key });

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  const user = await getCurrentUser();

  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  if (lastUserMessage) {
    const text = textFromUIMessage(lastUserMessage);
    if (text.trim()) {
      await prisma.chatMessage.create({
        data: { userId: user.id, role: "user", content: text },
      });
    }
  }

  const [context, modelMessages] = await Promise.all([
    buildCoachContext(user.id),
    convertToModelMessages(messages),
  ]);

  const result = streamText({
    model: google("gemini-flash-lite-latest"),
    system: `${SYSTEM_PROMPT}\n\nCurrent context:\n${context}`,
    messages: modelMessages,
    stopWhen: stepCountIs(5),
    maxOutputTokens: 1024,
    temperature: 0.6,
    tools: {
      getWorkouts: tool({
        description: "Get planned workouts for the athlete's active plan within a date range.",
        inputSchema: z.object({
          startDate: z.string().describe("Start date, YYYY-MM-DD, inclusive"),
          endDate: z.string().describe("End date, YYYY-MM-DD, inclusive"),
        }),
        execute: async ({ startDate, endDate }) => {
          const plan = await prisma.trainingPlan.findFirst({
            where: { userId: user.id, status: "ACTIVE" },
          });
          if (!plan) return { error: "No active plan" };
          const workouts = await prisma.plannedWorkout.findMany({
            where: {
              planId: plan.id,
              date: { gte: new Date(`${startDate}T00:00:00.000Z`), lte: new Date(`${endDate}T23:59:59.999Z`) },
            },
            orderBy: { date: "asc" },
          });
          return {
            workouts: workouts.map((w) => ({
              id: w.id,
              date: w.date.toDateString(),
              workoutType: w.workoutType,
              targetDistanceMi: w.targetDistanceMi,
              description: w.description,
              status: w.status,
            })),
          };
        },
      }),
      adjustWorkouts: tool({
        description:
          "Adjust one or more planned workouts by date -- change status, distance, or description, and record why. Use this whenever you tell the athlete their plan has changed.",
        inputSchema: z.object({
          updates: z
            .array(
              z.object({
                date: z.string().describe("Date of the workout to adjust, YYYY-MM-DD"),
                status: z.enum(["SCHEDULED", "COMPLETED", "MISSED", "ADJUSTED", "SKIPPED"]).optional(),
                workoutType: z
                  .enum(["EASY", "LONG", "TEMPO", "INTERVALS", "HILLS", "RACE_PACE", "CROSS", "REST", "RACE"])
                  .optional(),
                targetDistanceMi: z.number().min(0).max(150).nullable().optional(),
                description: z.string().min(1).max(500).optional(),
                adjustmentNote: z.string().min(1).max(500).describe("Why this changed"),
              })
            )
            .min(1),
        }),
        execute: async ({ updates }) => {
          const plan = await prisma.trainingPlan.findFirst({
            where: { userId: user.id, status: "ACTIVE" },
          });
          if (!plan) return { error: "No active plan" };

          const results = [];
          for (const u of updates) {
            const dayStart = new Date(`${u.date}T00:00:00.000Z`);
            const dayEnd = new Date(dayStart.getTime() + 86400000);
            const workout = await prisma.plannedWorkout.findFirst({
              where: { planId: plan.id, date: { gte: dayStart, lt: dayEnd } },
            });
            if (!workout) {
              results.push({ date: u.date, ok: false, error: "No workout found on that date" });
              continue;
            }
            const updated = await prisma.plannedWorkout.update({
              where: { id: workout.id },
              data: {
                status: u.status ?? (workout.status === "SCHEDULED" ? "ADJUSTED" : workout.status),
                workoutType: u.workoutType,
                targetDistanceMi: u.targetDistanceMi,
                description: u.description,
                adjustmentNote: u.adjustmentNote,
              },
            });
            results.push({ date: u.date, ok: true, workout: updated });
          }
          return { results };
        },
      }),
    },
    onFinish: async ({ text }) => {
      if (text.trim()) {
        await prisma.chatMessage.create({
          data: { userId: user.id, role: "assistant", content: text },
        });
      }
    },
  });

  return result.toUIMessageStreamResponse();
}

export async function GET() {
  const user = await getCurrentUser();
  const messages = await getChatHistory(user.id);
  return NextResponse.json({ messages });
}
