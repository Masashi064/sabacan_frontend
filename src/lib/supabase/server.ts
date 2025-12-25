// src/lib/supabase/server.ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function supabaseServer() {
  const cookieStore = await cookies(); // Next 16 は await 必須

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      // ✅ サーバーは Request Cookies から全件読む
      getAll() {
        return cookieStore.getAll().map((c) => ({
          name: c.name,
          value: c.value,
        }));
      },

      // ✅ ここが重要：SSR がセッションを cookie に反映できるようにする
      // Server Component では set が禁止される場合があるので try/catch で握りつぶすのが定番
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Component だとここに来ることがある（Route Handler なら通る）
        }
      },
    },
  });
}
