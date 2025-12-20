"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
        const code = searchParams.get("code");
        const next = searchParams.get("next") || "/";

        // ✅ code がある → セッション交換して進む
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error(error);
            setMessage("Sign-in failed. Please try again.");
            return;
          }
          router.replace(next);
          return;
        }

        // ✅ code がない → でもログイン済みなら進む（ここが今回の修正ポイント）
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error(error);
        }

        if (session) {
          router.replace(next);
          return;
        }

        // ❌ 未ログインで code もない → ログインへ戻す
        router.replace("/login?error=missing_code");
      } catch (e) {
        console.error(e);
        setMessage("Unexpected error. Please try again.");
      }
    };

    run();
  }, [router, searchParams]);

  return <div className="p-6">{message}</div>;
}
