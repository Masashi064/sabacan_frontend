import { Suspense } from "react";
import LoginClient from "./LoginClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-md px-6 py-16">
          <div className="rounded-xl border bg-white p-6">
            <div className="text-lg font-semibold">Loading…</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Preparing the login page.
            </p>
          </div>
        </main>
      }
    >
      <LoginClient />
    </Suspense>
  );
}
