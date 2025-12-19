import { ArticleCard, type ArticleCardData } from "@/components/ArticleCard";

export function ArticleGrid({
  items,
}: {
  items: ArticleCardData[];
}) {
  if (items.length === 0) {
    return (
      <section className="rounded-xl border bg-white p-6">
        <h2 className="text-lg font-semibold">No results</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Try adjusting filters or clearing the search keyword.
        </p>
      </section>
    );
  }

  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((a) => (
        <ArticleCard key={a.slug} article={a} href={`/articles/${a.slug}`} />
      ))}
    </section>
  );
}
