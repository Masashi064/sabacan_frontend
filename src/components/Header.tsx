"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo } from "react";
import { LogOut, User as UserIcon } from "lucide-react";

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
import { useAuth } from "@/lib/auth/AuthProvider";
import { SearchDialog } from "@/components/SearchDialog";
import { DailyStatsBadges } from "@/components/DailyStatsBadges";
import { getDisplayName, getAvatarUrl, initials } from "@/lib/auth/userDisplay";

export function Header() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const { user } = useAuth();

  return (
    <header className="border-b bg-background">
      <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
        {/* Left */}
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md transition-opacity hover:opacity-75 active:opacity-50"
        >
          <Image src="/logo.png" alt="" width={28} height={28} priority />
          <span className="font-semibold tracking-tight">Sabacan365</span>
        </Link>

        {/* Right */}
        <div className="flex items-center gap-2">
          <SearchDialog />
          <DailyStatsBadges />
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