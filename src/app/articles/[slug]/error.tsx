"use client";

import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ArticleError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-4xl p-6 space-y-4">
      <Link href="/" className="text-sm underline">← Back</Link>
      <Card>
        <CardHeader><CardTitle>Unable to load this video</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Please try again later.</p>
          <Button type="button" variant="outline" onClick={reset}>Try again</Button>
        </CardContent>
      </Card>
    </main>
  );
}
