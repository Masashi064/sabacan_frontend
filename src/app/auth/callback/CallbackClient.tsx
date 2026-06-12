"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function CallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Signing you in...");

  useEffect(() => {
    const run = async () => {
      // Create the client inside the effect so it is never shared across renders.
      const supabase = supabaseBrowser();

      try {
        const code = searchParams.get("code");
        const next = searchParams.get("next") || "/";

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

        // No code — redirect if already signed in, otherwise go back to login.
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) console.error(error);

        router.replace(session ? next : "/login?error=missing_code");
      } catch (e) {
        console.error(e);
        setMessage("Unexpected error. Please try again.");
      }
    };

    run();
  }, [router, searchParams]);

  return <div className="p-6">{message}</div>;
}
