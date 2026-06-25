import type { User } from "@supabase/supabase-js";

export function getDisplayName(user: User) {
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

export function getAvatarUrl(user: User) {
  const md: any = user.user_metadata ?? {};
  return md.avatar_url || md.picture || null;
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  const first = parts[0]?.[0] ?? "U";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase();
}
