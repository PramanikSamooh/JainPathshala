"use client";

import { useEffect } from "react";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Auth error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="rounded-xl border border-red-200 bg-red-50 p-8 max-w-md text-center">
        <h2 className="text-lg font-semibold text-red-700">Authentication Error</h2>
        <p className="mt-2 text-sm text-red-600">
          {error.message || "Something went wrong with authentication."}
        </p>
        <div className="mt-4 flex gap-3 justify-center">
          <button
            onClick={reset}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white bg-blue-600"
          >
            Try again
          </button>
          <a
            href="/login"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Back to Login
          </a>
        </div>
      </div>
    </div>
  );
}
