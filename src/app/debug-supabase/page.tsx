// src/app/debug-supabase/page.tsx

import { supabaseBrowser } from "@/lib/supabase/client";

const TABLE_NAME = "favorite_words"; // ←あなたの元コードに合わせてOK

export default async function DebugSupabasePage() {
  const supabase = await supabaseBrowser(); // ✅ await する

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .limit(1);

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
