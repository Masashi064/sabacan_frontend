import { Suspense } from "react";
import CallbackClient from "./CallbackClient";

export const dynamic = "force-dynamic"; // ★これで静的プリレンダーから外す
export const revalidate = 0;

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-md px-6 py-16">
          <div className="rounded-xl border bg-white p-6">
            <div className="text-lg font-semibold">Signing you in…</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Please wait a moment.
            </p>
          </div>
        </main>
      }
    >
      <CallbackClient />
    </Suspense>
  );
}
