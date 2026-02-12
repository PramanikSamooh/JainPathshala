"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <div className="rounded-xl border border-red-200 bg-red-50 p-8 max-w-md">
        <h2 className="text-lg font-semibold text-red-700">Something went wrong</h2>
        <p className="mt-2 text-sm text-red-600">
          {error.message || "An unexpected error occurred. Please try again."}
        </p>
        <div className="mt-4 flex gap-3 justify-center">
          <button
            onClick={reset}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white bg-[var(--brand-primary)]"
          >
            Try again
          </button>
          <a
            href="/dashboard"
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--muted)]"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
