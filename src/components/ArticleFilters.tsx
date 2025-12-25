"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  channelOptions: string[];
  categoryOptions: string[];
  levelOptions: string[];
};

function buildUrl(params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();

  // defaults
  const defaults = {
    sort: "published_date",
    order: "desc",
    completion: "all",
  };

  for (const [k, v] of Object.entries(params)) {
    if (!v) continue;

    // omit defaults to keep URL clean
    if (k in defaults && v === (defaults as any)[k]) continue;

    // omit "all" style values
    if (v === "all") continue;

    sp.set(k, v);
  }

  const qs = sp.toString();
  return qs ? `/?${qs}` : "/";
}

export function ArticleFilters({
  channelOptions,
  categoryOptions,
  levelOptions,
}: Props) {
  const router = useRouter();
  const sp = useSearchParams();

  const [q, setQ] = React.useState(sp.get("q") ?? "");
  const [sort, setSort] = React.useState(sp.get("sort") ?? "published_date");
  const [order, setOrder] = React.useState(sp.get("order") ?? "desc");

  const [channel, setChannel] = React.useState(sp.get("channel") ?? "all");
  const [category, setCategory] = React.useState(sp.get("category") ?? "all");
  const [level, setLevel] = React.useState(sp.get("level") ?? "all");
  const [completion, setCompletion] = React.useState(
    sp.get("completion") ?? "all"
  );

  const apply = React.useCallback(
    (next?: Partial<Record<string, string>>) => {
      const url = buildUrl({
        q,
        sort,
        order,
        channel,
        category,
        level,
        completion,
        ...(next ?? {}),
      });
      router.push(url);
    },
    [router, q, sort, order, channel, category, level, completion]
  );

  return (
    <div className="rounded-xl border p-4 bg-background space-y-4">
      <div className="space-y-2">
        <Label htmlFor="search">Search</Label>
        <Input
          id="search"
          value={q}
          placeholder="Video title or channel..."
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") apply({ q });
          }}
        />
        <div className="grid grid-cols-2 gap-2">
            <Button type="button" onClick={() => apply({ q })}>
                Search
            </Button>
            <Button
                type="button"
                variant="secondary"
                onClick={() => {
                setQ("");
                apply({ q: "" });
                }}
            >
                Clear
            </Button>
            </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <Label>Sort</Label>
        <Select
          value={sort}
          onValueChange={(v) => {
            setSort(v);
            apply({ sort: v });
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="published_date">Published date</SelectItem>
            <SelectItem value="created_at">Added date</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={order}
          onValueChange={(v) => {
            setOrder(v);
            apply({ order: v });
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Order" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">Desc (new first)</SelectItem>
            <SelectItem value="asc">Asc (old first)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <div className="space-y-2">
        <Label>Channel</Label>
        <Select
          value={channel}
          onValueChange={(v) => {
            setChannel(v);
            apply({ channel: v });
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="All Channels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Channels</SelectItem>
            {channelOptions.map((x) => (
              <SelectItem key={x} value={x}>
                {x}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Category</Label>
        <Select
          value={category}
          onValueChange={(v) => {
            setCategory(v);
            apply({ category: v });
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categoryOptions.map((x) => (
              <SelectItem key={x} value={x}>
                {x}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Level</Label>
        <Select
          value={level}
          onValueChange={(v) => {
            setLevel(v);
            apply({ level: v });
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="All Levels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            {levelOptions.map((x) => (
              <SelectItem key={x} value={x}>
                {x}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Completion</Label>
        <Select
          value={completion}
          onValueChange={(v) => {
            setCompletion(v);
            apply({ completion: v });
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="All Quizzes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Quizzes</SelectItem>
            <SelectItem value="complete">Complete (quiz)</SelectItem>
            <SelectItem value="incomplete">Incomplete</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <Button
        variant="secondary"
        className="w-full"
        onClick={() => {
          setQ("");
          setSort("published_date");
          setOrder("desc");
          setChannel("all");
          setCategory("all");
          setLevel("all");
          setCompletion("all");
          router.push("/");
        }}
      >
        Reset Filters
      </Button>
    </div>
  );
}
