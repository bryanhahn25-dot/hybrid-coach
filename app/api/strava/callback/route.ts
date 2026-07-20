import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import { exchangeCodeForToken } from "@/lib/strava";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/?strava_error=${encodeURIComponent(error)}`, req.url));
  }
  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  try {
    const token = await exchangeCodeForToken(code);
    const user = await getCurrentUser();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        stravaAthleteId: token.athlete?.id ? String(token.athlete.id) : user.stravaAthleteId,
        stravaAccessToken: token.access_token,
        stravaRefreshToken: token.refresh_token,
        stravaTokenExpiresAt: new Date(token.expires_at * 1000),
      },
    });
  } catch (err) {
    return NextResponse.redirect(
      new URL(`/?strava_error=${encodeURIComponent((err as Error).message)}`, req.url)
    );
  }

  return NextResponse.redirect(new URL("/?strava_connected=1", req.url));
}
