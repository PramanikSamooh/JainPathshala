export default function DashboardLoading() {
  return (
    <div className="animate-pulse">
      {/* Title skeleton */}
      <div className="h-8 w-48 rounded-lg bg-[var(--muted)]" />
      <div className="mt-2 h-4 w-32 rounded bg-[var(--muted)]" />

      {/* Cards skeleton */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
            <div className="h-3 w-20 rounded bg-[var(--muted)]" />
            <div className="mt-3 h-7 w-16 rounded bg-[var(--muted)]" />
          </div>
        ))}
      </div>

      {/* Content skeleton */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
            <div className="h-32 bg-[var(--muted)]" />
            <div className="p-4 space-y-2">
              <div className="h-4 w-3/4 rounded bg-[var(--muted)]" />
              <div className="h-3 w-1/2 rounded bg-[var(--muted)]" />
              <div className="mt-3 h-1.5 rounded-full bg-[var(--muted)]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
