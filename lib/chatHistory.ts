import { prisma } from "./prisma";

export interface StoredChatMessage {
  id: string;
  role: "user" | "assistant";
  parts: Array<{ type: "text"; text: string }>;
}

export async function getChatHistory(userId: string, limit = 100): Promise<StoredChatMessage[]> {
  const history = await prisma.chatMessage.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  return history.map((m) => ({
    id: String(m.id),
    role: m.role === "assistant" ? "assistant" : "user",
    parts: [{ type: "text", text: m.content }],
  }));
}
