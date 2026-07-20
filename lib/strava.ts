import { prisma } from "./prisma";
import type { User } from "@prisma/client";

const STRAVA_OAUTH_BASE = "https://www.strava.com/oauth";
const STRAVA_API_BASE = "https://www.strava.com/api/v3";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export function getAuthorizeUrl(redirectUri: string): string {
  const clientId = requireEnv("STRAVA_CLIENT_ID");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    approval_prompt: "auto",
    scope: "read,activity:read_all",
  });
  return `${STRAVA_OAUTH_BASE}/authorize?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix seconds
  athlete?: { id: number };
}

export async function exchangeCodeForToken(code: string): Promise<TokenResponse> {
  const res = await fetch(`${STRAVA_OAUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: requireEnv("STRAVA_CLIENT_ID"),
      client_secret: requireEnv("STRAVA_CLIENT_SECRET"),
      code,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw new Error(`Strava token exchange failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch(`${STRAVA_OAUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: requireEnv("STRAVA_CLIENT_ID"),
      client_secret: requireEnv("STRAVA_CLIENT_SECRET"),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`Strava token refresh failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/** Returns a valid access token for the user, refreshing and persisting it first if expired. */
export async function ensureFreshAccessToken(user: User): Promise<string> {
  if (!user.stravaRefreshToken) {
    throw new Error("User has not connected Strava yet");
  }
  const expiresAt = user.stravaTokenExpiresAt?.getTime() ?? 0;
  const isExpiringSoon = expiresAt - Date.now() < 5 * 60 * 1000;

  if (user.stravaAccessToken && !isExpiringSoon) {
    return user.stravaAccessToken;
  }

  const refreshed = await refreshAccessToken(user.stravaRefreshToken);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      stravaAccessToken: refreshed.access_token,
      stravaRefreshToken: refreshed.refresh_token,
      stravaTokenExpiresAt: new Date(refreshed.expires_at * 1000),
    },
  });
  return refreshed.access_token;
}

export interface StravaActivity {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  start_date: string;
  start_date_local: string;
  distance: number; // meters
  moving_time: number; // seconds
  total_elevation_gain: number; // meters
  average_speed: number; // m/s
  average_heartrate?: number;
  calories?: number;
}

export async function fetchActivitiesSince(
  accessToken: string,
  afterUnixSeconds: number
): Promise<StravaActivity[]> {
  const results: StravaActivity[] = [];
  let page = 1;
  for (;;) {
    const params = new URLSearchParams({
      after: String(afterUnixSeconds),
      per_page: "100",
      page: String(page),
    });
    const res = await fetch(`${STRAVA_API_BASE}/athlete/activities?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`Strava activities fetch failed: ${res.status} ${await res.text()}`);
    }
    const batch: StravaActivity[] = await res.json();
    results.push(...batch);
    if (batch.length < 100) break;
    page += 1;
    if (page > 10) break; // safety cap
  }
  return results;
}
