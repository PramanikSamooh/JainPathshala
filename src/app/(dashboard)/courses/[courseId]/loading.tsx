export default function CourseDetailLoading() {
  return (
    <div className="animate-pulse max-w-4xl">
      {/* Back link */}
      <div className="h-4 w-20 rounded bg-[var(--muted)]" />

      {/* Hero / thumbnail */}
      <div className="mt-4 h-48 w-full rounded-xl bg-[var(--muted)]" />

      {/* Title + meta */}
      <div className="mt-4 h-7 w-2/3 rounded-lg bg-[var(--muted)]" />
      <div className="mt-2 h-4 w-1/3 rounded bg-[var(--muted)]" />

      {/* Description */}
      <div className="mt-6 space-y-2">
        <div className="h-3 w-full rounded bg-[var(--muted)]" />
        <div className="h-3 w-5/6 rounded bg-[var(--muted)]" />
        <div className="h-3 w-4/6 rounded bg-[var(--muted)]" />
      </div>

      {/* Modules */}
      <div className="mt-8 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="h-5 w-1/2 rounded bg-[var(--muted)]" />
            <div className="mt-2 h-3 w-1/4 rounded bg-[var(--muted)]" />
          </div>
        ))}
      </div>
    </div>
  );
}
