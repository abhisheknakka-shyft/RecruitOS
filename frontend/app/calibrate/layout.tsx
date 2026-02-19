import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default function CalibrateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-muted/30">Loading…</div>}>
      {children}
    </Suspense>
  );
}
