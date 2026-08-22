"use client";

import * as React from "react";

import { supabaseBrowser } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { PreferencesDialog } from "@/components/preferences/PreferencesDialog";

export function OnboardingGate() {
  const supabase = React.useMemo(() => supabaseBrowser(), []);
  const { user } = useAuth();
  const [open, setOpen] = React.useState(false);

  const checkOnboarding = React.useCallback(async () => {
    if (!user) {
      setOpen(false);
      return;
    }

    const { data } = await supabase
      .from("user_preferences")
      .select("onboarding_completed,onboarding_skipped")
      .eq("user_id", user.id)
      .maybeSingle();

    const completed = data?.onboarding_completed ?? false;
    const skipped = data?.onboarding_skipped ?? false;
    setOpen(!completed && !skipped);
  }, [supabase, user]);

  React.useEffect(() => {
    void checkOnboarding();
  }, [checkOnboarding]);

  return <PreferencesDialog open={open} onOpenChange={setOpen} mode="onboarding" />;
}
