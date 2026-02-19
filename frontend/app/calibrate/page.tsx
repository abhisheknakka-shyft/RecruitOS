import { Suspense } from "react";
import { CalibrateClient } from "./CalibrateClient";

export default function CalibratePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-muted/30">
          <div className="text-muted-foreground">Loading…</div>
        </div>
      }
    >
      <CalibrateClient />
    </Suspense>
  );
}
