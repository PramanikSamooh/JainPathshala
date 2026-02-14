export default function CertificatesLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-40 rounded-lg bg-[var(--muted)]" />
      <div className="mt-2 h-4 w-48 rounded bg-[var(--muted)]" />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
            <div className="h-32 rounded-lg bg-[var(--muted)]" />
            <div className="mt-3 h-4 w-3/4 rounded bg-[var(--muted)]" />
            <div className="mt-2 h-3 w-1/2 rounded bg-[var(--muted)]" />
            <div className="mt-3 h-8 w-28 rounded-lg bg-[var(--muted)]" />
          </div>
        ))}
      </div>
    </div>
  );
}
