"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginClient() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/account";
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const onGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      const supabase = supabaseBrowser();
      const origin = window.location.origin;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });

      if (error) throw error;
    } catch (e: any) {
      setError(e?.message ?? "Login failed.");
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Login</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <Button
            onClick={onGoogle}
            className="w-full"
            disabled={loading}
          >
            {loading ? "Redirecting…" : "Continue with Google"}
          </Button>

          <p className="text-xs text-muted-foreground">
            You’ll be redirected to Google, then back to Sabacan365.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
