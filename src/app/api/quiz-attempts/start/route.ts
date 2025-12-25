import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const { slug, videoId, totalQuestions } = await req.json();
  if (!slug) return NextResponse.json({ error: "slug is required" }, { status: 400 });

  const supabase = await supabaseServer();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ✅ すでに未完了attemptがあれば再利用（増殖防止）
  const { data: existing } = await supabase
    .from("quiz_attempts")
    .select("id, started_at")
    .eq("user_id", userRes.user.id)
    .eq("slug", slug)
    .is("completed_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return NextResponse.json({ attemptId: existing.id, startedAt: existing.started_at });

  const { data, error } = await supabase
    .from("quiz_attempts")
    .insert({
      user_id: userRes.user.id,
      slug,
      video_id: videoId,
      total_questions: totalQuestions ?? null,
      started_at: new Date().toISOString(),
    })
    .select("id, started_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ attemptId: data.id, startedAt: data.started_at });
}
