"use client";

import * as React from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function ReportIssueButton({
  slug,
  videoId,
}: {
  slug: string;
  videoId: string | null;
}) {
  const supabase = React.useMemo(() => supabaseBrowser(), []);
  const [open, setOpen] = React.useState(false);
  const [reportType, setReportType] = React.useState("quiz_error");
  const [note, setNote] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit() {
    setSending(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("article_reports").insert({
      slug,
      video_id: videoId,
      report_type: reportType,
      note: note || null,
      page_url: window.location.href,
      user_id: user?.id ?? null,
    });

    if (error) {
      setError(error.message);
      setSending(false);
      return;
    }

    setDone(true);
    setSending(false);
    setNote("");
  }

  return (
    <div className="rounded-xl border p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-medium">Found a problem?</div>
          <div className="text-sm text-muted-foreground">
            Help us improve this article.
          </div>
        </div>
        <Button variant="outline" onClick={() => setOpen((v) => !v)}>
          {open ? "Close" : "Report an issue"}
        </Button>
      </div>

      {open ? (
        <div className="space-y-3">
          <select
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
          >
            <option value="quiz_error">Quiz is wrong</option>
            <option value="vocab_error">Vocabulary is wrong</option>
            <option value="explanation_error">Explanation is wrong</option>
            <option value="layout_bug">Layout problem</option>
            <option value="other">Other</option>
          </select>

          <textarea
            className="w-full rounded-md border px-3 py-2 text-sm"
            rows={4}
            placeholder="Optional details"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          <Button onClick={handleSubmit} disabled={sending}>
            {sending ? "Sending..." : "Submit report"}
          </Button>

          {done ? (
            <p className="text-sm text-green-600">Thanks. Your report was sent.</p>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}