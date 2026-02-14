export default function CoursesLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-[var(--muted)]" />
      <div className="mt-2 h-4 w-64 rounded bg-[var(--muted)]" />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
            <div className="h-36 bg-[var(--muted)]" />
            <div className="p-4 space-y-2">
              <div className="h-4 w-3/4 rounded bg-[var(--muted)]" />
              <div className="h-3 w-1/2 rounded bg-[var(--muted)]" />
              <div className="mt-3 h-8 w-24 rounded-lg bg-[var(--muted)]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
