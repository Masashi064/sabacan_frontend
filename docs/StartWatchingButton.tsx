"use client";

import * as React from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function StartWatchingButton({
  slug,
  videoId,
}: {
  slug: string;
  videoId?: string | null;
}) {
  const [started, setStarted] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const onStart = async () => {
    setLoading(true);
    try {
      const supabase = supabaseBrowser();

      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr) throw userErr;
      if (!user) throw new Error("You must be logged in.");

      const { error } = await supabase.from("learning_events").insert({
        user_id: user.id,
        slug,
        video_id: videoId ?? null,
        event_type: "video_start",
      });

      if (error) throw error;

      setStarted(true);
    } catch (e: any) {
      alert(e?.message ?? "Failed to start session.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <Button onClick={onStart} disabled={loading || started}>
        {started ? "Started" : loading ? "Starting…" : "Start watching"}
      </Button>
      <p className="text-sm text-muted-foreground">
        Study time starts when you press this button.
      </p>
    </div>
  );
}
