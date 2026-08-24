"use client";

import * as React from "react";

import { ReportIssueButton } from "@/components/article/ReportIssueButton";

// A secondary, low-emphasis action below the learning section — a plain
// text toggle rather than a card, so it doesn't compete with Quiz /
// Vocabulary / Transcript for attention.
export function ReportIssueSection({
  slug,
  videoId,
}: {
  slug: string;
  videoId: string | null;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        {open ? "Close" : "Found a problem? Report an issue"}
      </button>

      {open ? <ReportIssueButton slug={slug} videoId={videoId} /> : null}
    </div>
  );
}
