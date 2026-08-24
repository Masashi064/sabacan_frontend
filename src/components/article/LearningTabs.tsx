"use client";

import * as React from "react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyButton } from "@/components/article/CopyButton";
import { QuizSection, type QuizQuestion } from "@/components/quiz/QuizSection";
import { VocabularySection, type VocabItem } from "@/components/vocab/VocabularySection";

// Quiz, Vocabulary, and Transcript used to be three separate stacked
// cards, forcing a scroll past the video just to discover Vocabulary
// and Transcript exist. This merges them into one container with tabs
// so all three learning tools are visible immediately, and switching
// between them doesn't move the container or change its width.
export function LearningTabs({
  quiz,
  slug,
  videoId,
  vocabItems,
  transcriptParagraphs,
}: {
  quiz: QuizQuestion[];
  slug: string;
  videoId: string | null;
  vocabItems: VocabItem[];
  transcriptParagraphs: string[];
}) {
  const [tab, setTab] = React.useState("quiz");
  const [progress, setProgress] = React.useState<{ current: number; total: number } | null>(
    null
  );

  return (
    <Card className="gap-0 py-0">
      <Tabs value={tab} onValueChange={setTab} className="gap-0">
        <CardHeader className="border-b px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <TabsList variant="line">
              <TabsTrigger value="quiz">Quiz</TabsTrigger>
              <TabsTrigger value="vocabulary">Vocabulary</TabsTrigger>
              <TabsTrigger value="transcript">Transcript</TabsTrigger>
            </TabsList>

            {tab === "quiz" && progress ? (
              <span className="text-sm text-muted-foreground">
                {progress.current} / {progress.total}
              </span>
            ) : null}
            {tab === "transcript" && transcriptParagraphs.length > 0 ? (
              <CopyButton text={transcriptParagraphs.join("\n\n")} />
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="px-4 py-4 sm:px-6">
          {/* forceMount + manual hiding (instead of letting Radix unmount
              inactive panels) keeps QuizSection mounted the whole time, so
              switching tabs mid-quiz can't wipe its answered/current-index
              state and silently reset progress. */}
          <TabsContent value="quiz" forceMount className={tab === "quiz" ? undefined : "hidden"}>
            {quiz.length > 0 ? (
              <QuizSection
                quiz={quiz}
                slug={slug}
                videoId={videoId}
                onProgressChange={(current, total) => setProgress({ current, total })}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Quiz data is not available yet for this article.
              </p>
            )}
          </TabsContent>

          <TabsContent
            value="vocabulary"
            forceMount
            className={tab === "vocabulary" ? undefined : "hidden"}
          >
            {vocabItems.length > 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {vocabItems.length} word{vocabItems.length === 1 ? "" : "s"} to learn — tap
                  cards to flip and save favorites.
                </p>
                <VocabularySection items={vocabItems} slug={slug} videoId={videoId} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Vocabulary data is not available yet for this article.
              </p>
            )}
          </TabsContent>

          <TabsContent
            value="transcript"
            forceMount
            className={tab === "transcript" ? undefined : "hidden"}
          >
            {transcriptParagraphs.length > 0 ? (
              <div className="space-y-3">
                {transcriptParagraphs.map((p, i) => (
                  <p key={i} className="text-sm leading-relaxed text-muted-foreground">
                    {p}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Transcript is not available yet for this article.
              </p>
            )}
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
}
