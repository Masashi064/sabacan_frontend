"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import * as RadixDialog from "@radix-ui/react-dialog";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SearchDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const submit = (value: string) => {
    const term = value.trim();
    router.push(term ? `/?q=${encodeURIComponent(term)}` : "/");
    setOpen(false);
    setQ("");
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setQ("");
  };

  return (
    <RadixDialog.Root open={open} onOpenChange={handleOpenChange}>
      <RadixDialog.Trigger asChild>
        <Button variant="ghost" size="icon" aria-label="Search">
          <Search className="h-5 w-5" />
        </Button>
      </RadixDialog.Trigger>

      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-black/40" />

        <RadixDialog.Content
          className="fixed left-1/2 top-[18%] z-50 w-full max-w-lg -translate-x-1/2 px-4 focus:outline-none"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <RadixDialog.Title className="sr-only">Search</RadixDialog.Title>

          <div className="rounded-xl border bg-background shadow-xl p-4 space-y-3">
            {/* Search input row */}
            <div className="flex items-center gap-2 rounded-md border px-3 h-10">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit(q);
                }}
                placeholder="Search videos or channels..."
                className="border-0 shadow-none focus-visible:ring-0 p-0 h-auto text-sm bg-transparent"
              />
              {q ? (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Clear input"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button size="sm" className="flex-1" onClick={() => submit(q)}>
                Search
              </Button>
              <Button size="sm" variant="secondary" onClick={() => submit("")}>
                Clear search
              </Button>
              <RadixDialog.Close asChild>
                <Button size="sm" variant="ghost">
                  Cancel
                </Button>
              </RadixDialog.Close>
            </div>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
