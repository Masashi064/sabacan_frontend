import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";

  const supabase = createRouteHandlerClient({ cookies });

  // ✅ code があるならセッション交換して戻す
  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
    return NextResponse.redirect(new URL(next, url.origin));
  }

  // ✅ code が無くても、すでにログイン済みなら next に戻す
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    return NextResponse.redirect(new URL(next, url.origin));
  }

  // ❌ 未ログインで code も無い → ログインへ
  return NextResponse.redirect(new URL("/login?error=missing_code", url.origin));
}
