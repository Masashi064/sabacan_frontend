"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Volume2, Heart } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";

export type VocabItem = {
  word: string;
  pronunciation?: string;
  definition?: string;
  example?: string;
};

function speak(text: string) {
  if (typeof window === "undefined") return;
  const synth = window.speechSynthesis;
  if (!synth) return;

  try {
    synth.cancel();
  } catch {}

  const uttr = new SpeechSynthesisUtterance(text);
  uttr.lang = "en-US";
  uttr.rate = 0.95;
  uttr.pitch = 1.0;
  synth.speak(uttr);
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function VocabFlipCard({
  item,
  isFavorite,
  onToggleFavorite,
  busy,
}: {
  item: VocabItem;
  isFavorite: boolean;
  onToggleFavorite: (item: VocabItem) => void;
  busy: boolean;
}) {
  const [flipped, setFlipped] = React.useState(false);

  return (
    <div className="perspective-[1200px]">
      <div
        className={cn(
          "relative h-[280px] w-full transition-transform duration-500",
          "[transform-style:preserve-3d]",
          flipped ? "[transform:rotateY(180deg)]" : ""
        )}
        onClick={() => setFlipped((v) => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setFlipped((v) => !v);
        }}
      >
        {/* FRONT */}
        <Card className="absolute inset-0 overflow-hidden [backface-visibility:hidden]">
          <CardContent className="p-5 h-full flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold leading-tight break-words">
                    {item.word}
                  </h3>
                  {item.pronunciation ? (
                    <p className="text-sm text-muted-foreground">
                      {item.pronunciation}
                    </p>
                  ) : null}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      speak(item.word);
                    }}
                    aria-label="Play pronunciation"
                    title="Play pronunciation"
                  >
                    <Volume2 className="h-4 w-4" />
                  </Button>

                  <Button
                    type="button"
                    size="icon"
                    variant={isFavorite ? "default" : "outline"}
                    disabled={busy}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(item);
                    }}
                    aria-label="Toggle favorite"
                    title="Favorite"
                  >
                    <Heart
                      className={cn("h-4 w-4", isFavorite ? "fill-current" : "")}
                    />
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Tap to flip</Badge>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Speaker: pronunciation • Heart: favorite
            </p>
          </CardContent>
        </Card>

        {/* BACK */}
        <Card className="absolute inset-0 overflow-hidden [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <CardContent className="p-5 h-full flex flex-col gap-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">Definition</p>
              <p className="text-sm text-muted-foreground break-words">
                {item.definition ?? "—"}
              </p>
            </div>

            <div className="space-y-1 flex-1">
              <p className="text-sm font-medium">Example</p>
              <div className="rounded-md border bg-muted/20 p-3 text-sm leading-relaxed overflow-auto">
                <p className="break-words whitespace-pre-wrap">
                  {item.example ?? "—"}
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">Tap to flip back</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function VocabularySection({
  items,
  slug,
  videoId,
}: {
  items: VocabItem[];
  slug: string;
  videoId: string | null;
}) {
  const supabase = React.useMemo(() => supabaseBrowser(), []);

  const [localFav, setLocalFav] = React.useState<Set<string>>(new Set());
  const [busyWord, setBusyWord] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);

  // 初回に「このページに出ている単語の中で、お気に入り済み」を取得
  React.useEffect(() => {
    let alive = true;

    (async () => {
      setNote(null);

      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (!user) {
        // 未ログイン：お気に入りはローカル表示だけにする（最初は空でOK）
        return;
      }

      const words = items.map((x) => x.word).filter(Boolean);
      if (words.length === 0) return;

      const { data, error } = await supabase
        .from("favorite_words")
        .select("word")
        .eq("user_id", user.id)
        .in("word", words);

      if (!alive) return;

      if (error) {
        setNote(`Failed to load favorites: ${error.message}`);
        return;
      }

      setLocalFav(new Set((data ?? []).map((r) => r.word)));
    })();

    return () => {
      alive = false;
    };
  }, [items, supabase]);

  const toggleFavorite = async (item: VocabItem) => {
    setNote(null);

    const word = item.word;
    if (!word) return;

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    const user = userRes?.user;

    if (userErr || !user) {
      // 未ログイン時はDB保存できないので、UIだけ戻して案内
      setNote("Login to save favorites.");
      return;
    }

    const currentlyFav = localFav.has(word);

    // まずUIは即反映（体感を良くする）
    setLocalFav((prev) => {
      const next = new Set(prev);
      if (currentlyFav) next.delete(word);
      else next.add(word);
      return next;
    });

    setBusyWord(word);

    if (!currentlyFav) {
      // 追加：スナップショットを保存（CSV/PDF出力に強い）
      const { error } = await supabase.from("favorite_words").upsert(
        {
          user_id: user.id,
          word: item.word,
          pronunciation: item.pronunciation ?? null,
          definition: item.definition ?? null,
          example: item.example ?? null,
          slug: slug ?? null,
          video_id: videoId ?? null,
          created_at: new Date().toISOString(),
        },
        { onConflict: "user_id,word" }
      );

      if (error) {
        // 失敗したらUIを巻き戻す
        setLocalFav((prev) => {
          const next = new Set(prev);
          next.delete(word);
          return next;
        });
        setNote(`Failed to save favorite: ${error.message}`);
      }
    } else {
      // 削除
      const { error } = await supabase
        .from("favorite_words")
        .delete()
        .eq("user_id", user.id)
        .eq("word", word);

      if (error) {
        // 失敗したらUIを巻き戻す
        setLocalFav((prev) => {
          const next = new Set(prev);
          next.add(word);
          return next;
        });
        setNote(`Failed to remove favorite: ${error.message}`);
      }
    }

    setBusyWord(null);
  };

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Vocabulary</h2>
          <p className="text-sm text-muted-foreground">
            Tap a card to flip. Use the heart to save favorites.
          </p>
        </div>

        {note ? (
          <div className="text-xs text-muted-foreground text-right max-w-[320px]">
            {note}
          </div>
        ) : null}
      </div>

      {/* lg以上は2列（カード横幅に余裕）、モバイルは1列 */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {items.map((it) => (
          <VocabFlipCard
            key={it.word}
            item={it}
            isFavorite={localFav.has(it.word)}
            onToggleFavorite={toggleFavorite}
            busy={busyWord === it.word}
          />
        ))}
      </div>
    </section>
  );
}
