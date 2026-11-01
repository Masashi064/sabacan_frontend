import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ArticleNotFound() {
  return (
    <main className="mx-auto max-w-4xl p-6 space-y-4">
      <Link href="/" className="text-sm underline">← Back</Link>
      <Card>
        <CardHeader><CardTitle>Not found</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">This video could not be found.</p></CardContent>
      </Card>
    </main>
  );
}
