"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    const code = sp.get("code");
    const next = sp.get("next") || "/";

    if (!code) {
      router.replace("/login");
      return;
    }

    (async () => {
      const supabase = supabaseBrowser();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.error(error);
        router.replace("/login");
        return;
      }
      router.replace(next);
    })();
  }, [router, sp]);

  return (
    <main className="mx-auto max-w-md p-6">
      <p className="text-sm text-muted-foreground">Signing you in…</p>
    </main>
  );
}