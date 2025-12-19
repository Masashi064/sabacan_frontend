import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DebugSupabasePage() {
  const supabase = supabaseServer();

  const TABLE_NAME = "quiz"; // ←実在テーブル名に変更

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .limit(1);

  return (
    <main className="p-8 space-y-4">
      <h1 className="text-xl font-semibold">Supabase Debug</h1>

      {error ? (
        <pre className="rounded-lg border p-4 text-sm overflow-auto">
          {JSON.stringify(error, null, 2)}
        </pre>
      ) : (
        <pre className="rounded-lg border p-4 text-sm overflow-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </main>
  );
}
