"use client";

import * as React from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabaseBrowser } from "@/lib/supabase/client";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

const AuthContext = React.createContext<AuthContextValue>({
  session: null,
  user: null,
  loading: true,
});

// Single shared session read + onAuthStateChange subscription for the whole
// app shell. Header/CoinProvider/OnboardingGate all need to know "who is the
// current user" on every page load — without this they each ran their own
// getSession()/getUser() call and subscription, tripling the auth work done
// on every app open.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = React.useMemo(() => supabaseBrowser(), []);
  const [session, setSession] = React.useState<Session | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  const value = React.useMemo(
    () => ({ session, user: session?.user ?? null, loading }),
    [session, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return React.useContext(AuthContext);
}
