import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Converts a stored video_length string to YouTube-style display format.
 *
 * The DB may store durations as "M:SS:00" for sub-hour videos (a backend
 * formatting bug where seconds were treated as minutes and ":00" appended),
 * or correctly as "H:MM:SS" for hour-plus videos.
 *
 * Rules:
 *   3 parts, last = 0  →  treat as M:SS:00  →  "M:SS"   (e.g. "8:48:00" → "8:48")
 *   3 parts, last ≠ 0  →  treat as H:MM:SS  →  "H:MM:SS" or "M:SS" if H=0
 *   2 parts            →  already M:SS, returned as-is
 */
export function formatVideoLength(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const parts = trimmed.split(":").map((s) => parseInt(s, 10));
  if (parts.length < 2 || parts.length > 3 || parts.some(isNaN)) return trimmed;

  let totalSeconds: number;

  if (parts.length === 3) {
    const [a, b, c] = parts as [number, number, number];
    if (a === 0) {
      // H=0 → correctly stored H:MM:SS for a sub-hour video (e.g. "0:08:48")
      totalSeconds = b * 60 + c;
    } else if (c === 0) {
      // H>0, S=0 → M:SS:00 storage bug: minutes landed in the H slot (e.g. "8:48:00")
      totalSeconds = a * 60 + b;
    } else {
      // H>0, S>0 → correctly stored H:MM:SS for an hour-plus video (e.g. "1:08:48")
      totalSeconds = a * 3600 + b * 60 + c;
    }
  } else {
    const [m, s] = parts as [number, number];
    totalSeconds = m * 60 + s;
  }

  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}
