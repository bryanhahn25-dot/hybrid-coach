const METERS_PER_MILE = 1609.344;

export function metersToMiles(meters: number): number {
  return meters / METERS_PER_MILE;
}

export function milesToMeters(miles: number): number {
  return miles * METERS_PER_MILE;
}

export function metersPerSecondToPaceSecPerMi(mps: number): number | null {
  if (!mps) return null;
  const mph = mps / METERS_PER_MILE;
  return 1 / mph; // seconds per mile
}

export function paceSecPerMiToString(secPerMi: number | null | undefined): string {
  if (!secPerMi || !Number.isFinite(secPerMi)) return "--:--";
  const totalSec = Math.round(secPerMi);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}/mi`;
}

export function secondsToDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.round(totalSec % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function metersToFeet(meters: number): number {
  return meters * 3.28084;
}
