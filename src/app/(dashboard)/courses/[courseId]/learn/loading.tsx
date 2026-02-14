export default function LearnLoading() {
  return (
    <div className="animate-pulse flex flex-col lg:flex-row gap-6 max-w-6xl">
      {/* Sidebar skeleton */}
      <div className="hidden lg:block w-72 shrink-0 space-y-3">
        <div className="h-5 w-32 rounded bg-[var(--muted)]" />
        <div className="h-2 w-full rounded-full bg-[var(--muted)]" />
        <div className="mt-4 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-9 rounded-lg bg-[var(--muted)]" />
          ))}
        </div>
      </div>

      {/* Content skeleton */}
      <div className="flex-1 min-w-0 space-y-4">
        <div className="h-7 w-2/3 rounded-lg bg-[var(--muted)]" />
        <div className="h-[60vh] rounded-xl bg-[var(--muted)]" />
        <div className="space-y-2">
          <div className="h-3 w-full rounded bg-[var(--muted)]" />
          <div className="h-3 w-4/5 rounded bg-[var(--muted)]" />
        </div>
      </div>
    </div>
  );
}
