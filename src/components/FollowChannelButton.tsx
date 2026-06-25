"use client";

import * as React from "react";
import { Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabaseBrowser } from "@/lib/supabase/client";

export function FollowChannelButton({ channelName }: { channelName: string }) {
  const supabase = React.useMemo(() => supabaseBrowser(), []);
  const [userId, setUserId] = React.useState<string | null>(null);
  const [isFollowing, setIsFollowing] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let alive = true;

    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (!alive) return;

      if (!user) {
        setUserId(null);
        return;
      }
      setUserId(user.id);

      // One small existence check per card instance. Fine for the home
      // grid's scale (a few dozen cards); if this ever needs to cover a
      // much larger list, switch to a single batch fetch keyed by channel
      // name on mount, mirroring VocabularySection.tsx's favorites preload.
      const { data, error } = await supabase
        .from("favorite_channels")
        .select("id")
        .eq("user_id", user.id)
        .eq("channel_name", channelName)
        .maybeSingle();

      if (!alive || error) return;
      setIsFollowing(!!data);
    })();

    return () => {
      alive = false;
    };
  }, [supabase, channelName]);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!userId || busy) return;

    const next = !isFollowing;
    setIsFollowing(next);
    setBusy(true);

    if (next) {
      const { error } = await supabase
        .from("favorite_channels")
        .upsert(
          { user_id: userId, channel_name: channelName, created_at: new Date().toISOString() },
          { onConflict: "user_id,channel_name" }
        );
      if (error) {
        console.error("[FollowChannelButton] follow failed:", error.message);
        setIsFollowing(false);
      }
    } else {
      const { error } = await supabase
        .from("favorite_channels")
        .delete()
        .eq("user_id", userId)
        .eq("channel_name", channelName);
      if (error) {
        console.error("[FollowChannelButton] unfollow failed:", error.message);
        setIsFollowing(true);
      }
    }

    setBusy(false);
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-5 w-5 p-0 shrink-0"
      onClick={toggle}
      title={
        !userId
          ? "Login to follow channels"
          : isFollowing
          ? "Unfollow this channel"
          : "Follow this channel"
      }
      aria-label={isFollowing ? "Unfollow channel" : "Follow channel"}
    >
      <Star className={`h-3.5 w-3.5 ${isFollowing ? "fill-current text-amber-500" : ""}`} />
    </Button>
  );
}
