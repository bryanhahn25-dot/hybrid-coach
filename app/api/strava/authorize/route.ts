import { NextResponse } from "next/server";
import { getAuthorizeUrl } from "@/lib/strava";

export async function GET(req: Request) {
  const redirectUri = process.env.STRAVA_REDIRECT_URI ?? new URL("/api/strava/callback", req.url).toString();
  try {
    return NextResponse.redirect(getAuthorizeUrl(redirectUri));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
