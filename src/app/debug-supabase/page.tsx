// src/app/debug-supabase/page.tsx
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

const TABLE_NAME = "favorite_words";

export default async function DebugSupabasePage() {
  const supabase = await supabaseServer();

  // Require authentication — anonymous access is not allowed here.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/debug-supabase");

  const { data, error } = await supabase.from(TABLE_NAME).select("*").limit(1);

  if (error) {
    return (
      <main className="p-6">
        <pre className="text-red-600">{error.message}</pre>
      </main>
    );
  }

  return (
    <main className="p-6">
      <pre className="text-sm">{JSON.stringify(data, null, 2)}</pre>
    </main>
  );
}
