"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function CallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = React.useState("Completing sign-in…");

  React.useEffect(() => {
    const run = async () => {
      try {
        const error = searchParams.get("error");
        const errorDesc = searchParams.get("error_description");
        if (error) {
          setMessage(errorDesc ?? error);
          return;
        }

        // Supabase OAuth(PKCE) の callback は通常 `?code=...`
        const code = searchParams.get("code");
        if (code) {
          const supabase = supabaseBrowser();
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        // サインイン後の遷移先（好みで /account か /）
        router.replace("/account");
        router.refresh();
      } catch (e: any) {
        setMessage(e?.message ?? "Failed to sign in.");
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <div className="rounded-xl border bg-white p-6">
        <div className="text-lg font-semibold">Auth Callback</div>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      </div>
    </main>
  );
}
