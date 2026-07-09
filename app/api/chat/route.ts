import { google } from '@ai-sdk/google';
import { streamText } from 'ai';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = await streamText({
    model: google('gemini-1.5-flash'),
    system: "You are an endurance coaching engine. Your objective is to track the user's 34-week marathon build. Provide direct, objective analysis.",
    messages,
  });

return result.toTextStreamResponse();
}