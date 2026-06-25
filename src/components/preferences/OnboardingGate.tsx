"use client";

import * as React from "react";

import { supabaseBrowser } from "@/lib/supabase/client";
import { PreferencesDialog } from "@/components/preferences/PreferencesDialog";

export function OnboardingGate() {
  const supabase = React.useMemo(() => supabaseBrowser(), []);
  const [open, setOpen] = React.useState(false);

  const checkOnboarding = React.useCallback(async () => {
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;

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
  }, [supabase]);

  React.useEffect(() => {
    void checkOnboarding();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void checkOnboarding();
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, [supabase, checkOnboarding]);

  return <PreferencesDialog open={open} onOpenChange={setOpen} mode="onboarding" />;
}
