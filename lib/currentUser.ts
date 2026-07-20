import { prisma } from "./prisma";

// No auth system yet (single-user mode). Every request resolves to this one
// bootstrapped account. Swapping in real auth (e.g. Neon Auth) later just
// means replacing this lookup with the authenticated session's user id --
// every other model already keys off `userId`.
const DEFAULT_USER_EMAIL = "me@local";

export async function getCurrentUser() {
  const existing = await prisma.user.findUnique({
    where: { email: DEFAULT_USER_EMAIL },
  });
  if (existing) return existing;

  return prisma.user.create({
    data: { email: DEFAULT_USER_EMAIL, name: "Athlete" },
  });
}
