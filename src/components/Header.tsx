"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { BookOpen, LogOut, User as UserIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabaseBrowser } from "@/lib/supabase/client";

function getDisplayName(user: User) {
  const md: any = user.user_metadata ?? {};
  return (
    md.full_name ||
    md.name ||
    md.user_name ||
    md.preferred_username ||
    user.email ||
    "Account"
  );
}

function getAvatarUrl(user: User) {
  const md: any = user.user_metadata ?? {};
  return md.avatar_url || md.picture || null;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  const first = parts[0]?.[0] ?? "U";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase();
}

export function Header() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  const user = session?.user ?? null;

  return (
    <header className="border-b bg-background">
      <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
        {/* Left */}
        <Link href="/" className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-md border flex items-center justify-center">
            <BookOpen className="h-5 w-5" />
          </div>
          <span className="font-semibold tracking-tight">Sabacan365</span>
        </Link>

        {/* Right */}
        <div className="flex items-center gap-2">
          {!user ? (
            <Button asChild>
              <Link href="/login">Login</Link>
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-10 px-2 flex items-center gap-2"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={getAvatarUrl(user) ?? undefined} />
                    <AvatarFallback>
                      {initials(getDisplayName(user))}
                    </AvatarFallback>
                  </Avatar>

                  {/* Desktop only: name */}
                  <span className="hidden sm:inline text-sm font-medium max-w-[180px] truncate">
                    {getDisplayName(user)}
                  </span>
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="space-y-1">
                  <div className="text-sm font-medium truncate">
                    {getDisplayName(user)}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {user.email}
                  </div>
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                <DropdownMenuItem asChild>
                  <Link href="/account" className="flex items-center gap-2">
                    <UserIcon className="h-4 w-4" />
                    Account
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={async () => {
                    await supabase.auth.signOut();
                  }}
                  className="flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}