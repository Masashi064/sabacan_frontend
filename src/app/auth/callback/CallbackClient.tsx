// app/auth/callback/CallbackClient.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// ここはあなたの既存のsupabaseクライアント生成に合わせてください
// 例: import { supabase } from "@/lib/supabase/client";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function CallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Signing you in...");

  useEffect(() => {
    const run = async () => {
      try {
        // SupabaseのPKCE/Auth Code Flow想定（あなたの実装に合わせて調整）
        const code = searchParams.get("code");
        const next = searchParams.get("next") || "/";

        if (!code) {
          setMessage("Missing auth code. Please try again.");
          return;
        }

        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error(error);
          setMessage("Sign-in failed. Please try again.");
          return;
        }

        router.replace(next);
      } catch (e) {
        console.error(e);
        setMessage("Unexpected error. Please try again.");
      }
    };

    run();
  }, [router, searchParams]);

  return <div className="p-6">{message}</div>;
}
