"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PreferenceChipPicker } from "@/components/preferences/PreferenceChipPicker";
import { supabaseBrowser } from "@/lib/supabase/client";

type FilterOptionsRpcResult = {
  channels: string[] | null;
  categories: string[] | null;
  levels: string[] | null;
};

export function PreferencesDialog({
  open,
  onOpenChange,
  mode,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "onboarding" | "edit";
  onSaved?: () => void;
}) {
  const supabase = React.useMemo(() => supabaseBrowser(), []);

  const [userId, setUserId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [categoryOptions, setCategoryOptions] = React.useState<string[]>([]);
  const [channelOptions, setChannelOptions] = React.useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = React.useState<string[]>([]);
  const [selectedChannels, setSelectedChannels] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!open) return;

    let alive = true;
    setLoading(true);
    setError(null);

    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;

      if (!user) {
        if (alive) {
          setUserId(null);
          setLoading(false);
        }
        return;
      }

      const [filterOptionsRes, categoriesRes, channelsRes] = await Promise.all([
        supabase.rpc("get_filter_options"),
        supabase.from("favorite_categories").select("category_name").eq("user_id", user.id),
        supabase.from("favorite_channels").select("channel_name").eq("user_id", user.id),
      ]);

      if (!alive) return;

      setUserId(user.id);

      const opts = (filterOptionsRes.data ?? {}) as FilterOptionsRpcResult;
      setCategoryOptions(opts.categories ?? []);
      setChannelOptions(opts.channels ?? []);

      setSelectedCategories(
        (categoriesRes.data ?? []).map((r: { category_name: string }) => r.category_name)
      );
      setSelectedChannels(
        (channelsRes.data ?? []).map((r: { channel_name: string }) => r.channel_name)
      );

      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [open, supabase]);

  async function persistSelections() {
    if (!userId) return;

    await supabase.from("favorite_categories").delete().eq("user_id", userId);
    if (selectedCategories.length > 0) {
      await supabase
        .from("favorite_categories")
        .insert(selectedCategories.map((c) => ({ user_id: userId, category_name: c })));
    }

    await supabase.from("favorite_channels").delete().eq("user_id", userId);
    if (selectedChannels.length > 0) {
      await supabase
        .from("favorite_channels")
        .insert(selectedChannels.map((c) => ({ user_id: userId, channel_name: c })));
    }
  }

  async function handleSave() {
    if (!userId) return;
    setSaving(true);
    setError(null);

    try {
      await persistSelections();

      if (mode === "onboarding") {
        const { error: prefError } = await supabase.from("user_preferences").upsert(
          {
            user_id: userId,
            onboarding_completed: true,
            onboarding_skipped: false,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
        if (prefError) throw prefError;
      }

      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save preferences.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSkip() {
    if (userId) {
      const { error: prefError } = await supabase.from("user_preferences").upsert(
        {
          user_id: userId,
          onboarding_skipped: true,
          onboarding_completed: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
      if (prefError) console.error("[PreferencesDialog] skip failed:", prefError.message);
    }
    // Skipping must never block the app — close regardless of write outcome.
    onOpenChange(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      if (mode === "onboarding") {
        void handleSkip();
        return;
      }
      onOpenChange(false);
      return;
    }
    onOpenChange(true);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "onboarding" ? "Set Your Preferences" : "Edit Preferences"}
          </DialogTitle>
          <DialogDescription>
            Pick topics and channels you like to improve your recommendations. Both are
            optional and you can change them anytime from your Account page.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-4">
            <PreferenceChipPicker
              label="What topics do you like?"
              options={categoryOptions}
              selected={selectedCategories}
              onChange={setSelectedCategories}
            />
            <PreferenceChipPicker
              label="What channels do you like?"
              options={channelOptions}
              selected={selectedChannels}
              onChange={setSelectedChannels}
            />
          </div>
        )}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <DialogFooter>
          {mode === "onboarding" ? (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="sm:flex-1"
              onClick={handleSkip}
              disabled={saving}
            >
              Skip for now
            </Button>
          ) : null}
          <Button
            type="button"
            size="lg"
            className="sm:flex-1"
            onClick={handleSave}
            disabled={loading || saving || !userId}
          >
            {saving ? "Saving…" : "Save preferences"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
