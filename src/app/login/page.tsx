"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, Mail, ArrowLeft, Loader2 } from "lucide-react";

import { supabaseBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" {...props}>
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303C33.655 32.657 29.148 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.958 3.042l5.657-5.657C34.926 6.053 29.711 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.651-.389-3.917Z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 16.108 19.001 12 24 12c3.059 0 5.842 1.154 7.958 3.042l5.657-5.657C34.926 6.053 29.711 4 24 4 16.318 4 9.656 8.319 6.306 14.691Z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.044 0 10.162-1.989 13.805-5.725l-6.372-5.394C29.36 34.476 26.81 36 24 36c-5.129 0-9.623-3.317-11.288-7.946l-6.522 5.025C9.506 39.556 16.227 44 24 44Z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.79 2.208-2.255 4.08-4.17 5.281l.003-.002 6.372 5.394C36.98 39.656 44 35 44 24c0-1.341-.138-2.651-.389-3.917Z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/";

  const supabase = React.useMemo(() => supabaseBrowser(), []);

  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState<"google" | "email" | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  return (
    <main className="min-h-[calc(100vh-56px)] bg-background">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <Button
          asChild
          variant="ghost"
          className="mb-6 -ml-2"
          aria-label="Back"
        >
          <Link href={next}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>

        <div className="mx-auto max-w-md">
          <Card className="overflow-hidden">
            <CardHeader className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-md border flex items-center justify-center">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-xl">Sign in to Sabacan365</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Track quiz progress and save favorite words.
                  </p>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Google */}
              <div className="space-y-3">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 justify-center gap-2"
                  disabled={loading !== null}
                  onClick={async () => {
                    setMessage(null);
                    setLoading("google");
                    try {
                      await supabase.auth.signInWithOAuth({
                        provider: "google",
                        options: {
                          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
                            next
                          )}`,
                        },
                      });
                      // OAuth はここでページ遷移するので、通常ここには戻りません
                    } catch (e: any) {
                      setMessage(e?.message ?? "Failed to start Google login.");
                      setLoading(null);
                    }
                  }}
                >
                  {loading === "google" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <GoogleIcon className="h-5 w-5" />
                  )}
                  Continue with Google
                </Button>

                <div className="relative">
                  <Separator />
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">
                    or
                  </span>
                </div>
              </div>

              {/* Email magic link */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    We’ll email you a sign-in link (no password).
                  </p>
                </div>

                <Button
                  type="button"
                  className="w-full h-11 gap-2"
                  disabled={loading !== null || !email.trim()}
                  onClick={async () => {
                    setMessage(null);
                    setLoading("email");

                    const { error } = await supabase.auth.signInWithOtp({
                      email: email.trim(),
                      options: {
                        // magic link から戻る場所
                        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
                          next
                        )}`,
                      },
                    });

                    setLoading(null);

                    if (error) {
                      setMessage(error.message);
                      return;
                    }
                    setMessage("Check your email for the sign-in link.");
                  }}
                >
                  {loading === "email" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                  Send magic link
                </Button>

                {message ? (
                  <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                    {message}
                  </div>
                ) : null}
              </div>

              <p className="text-xs text-muted-foreground">
                By continuing, you agree to our{" "}
                <span className="underline underline-offset-2">Terms</span> and{" "}
                <span className="underline underline-offset-2">Privacy Policy</span>.
              </p>
            </CardContent>
          </Card>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Trouble signing in?{" "}
            <Link href="/" className="underline underline-offset-2">
              Go back home
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
