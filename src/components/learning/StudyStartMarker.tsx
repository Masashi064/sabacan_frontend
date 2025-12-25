"use client";

import { useEffect, useRef } from "react";

const MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6h: タブ放置で古すぎる開始時刻を使わない保険

export default function StudyStartMarker({ slug }: { slug: string }) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;

    const key = `studyStartMs:${slug}`;
    const now = Date.now();

    const existing = sessionStorage.getItem(key);
    const existingMs = existing ? Number(existing) : NaN;

    // 既にあって新しければそのまま（リロードで増殖しない）
    if (Number.isFinite(existingMs) && now - existingMs < MAX_AGE_MS) return;

    sessionStorage.setItem(key, String(now));
  }, [slug]);

  return null;
}
