// app/auth/callback/page.tsx
import { Suspense } from "react";
import CallbackClient from "./CallbackClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Signing you in...</div>}>
      <CallbackClient />
    </Suspense>
  );
}
