export default function AdminLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-36 rounded-lg bg-[var(--muted)]" />
      <div className="mt-2 h-4 w-56 rounded bg-[var(--muted)]" />

      {/* Table skeleton */}
      <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        {/* Header */}
        <div className="flex gap-4 border-b border-[var(--border)] p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-4 flex-1 rounded bg-[var(--muted)]" />
          ))}
        </div>
        {/* Rows */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-4 border-b border-[var(--border)] p-4 last:border-0">
            {Array.from({ length: 5 }).map((_, j) => (
              <div key={j} className="h-4 flex-1 rounded bg-[var(--muted)]" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
