"use client";

import { useEffect, useState } from "react";

interface EnrollmentItem {
  id: string;
  userId: string;
  courseId: string;
  status: string;
  enrolledAt: string;
  progress: {
    percentComplete: number;
    completedLessons: number;
    totalLessons: number;
  };
  userName?: string;
  userEmail?: string;
  courseTitle?: string;
}

function formatFirestoreDate(val: unknown): string {
  if (!val) return "\u2014";
  if (typeof val === "object" && val !== null && "_seconds" in val) {
    return new Date(
      (val as { _seconds: number })._seconds * 1000
    ).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  const d = new Date(val as string | number);
  return isNaN(d.getTime())
    ? "\u2014"
    : d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

const STATUS_TABS = ["all", "active", "completed", "pending_payment", "expired", "cancelled"] as const;
type StatusTab = (typeof STATUS_TABS)[number];

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  pending_payment: "bg-yellow-100 text-yellow-700",
  expired: "bg-red-100 text-red-700",
  completed: "bg-blue-100 text-blue-700",
  cancelled: "bg-gray-100 text-gray-600",
  refunded: "bg-orange-100 text-orange-700",
};

export default function AdminEnrollmentsPage() {
  const [enrollments, setEnrollments] = useState<EnrollmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<StatusTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    async function fetchEnrollments() {
      try {
        const res = await fetch("/api/enrollments?include=all", {
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          setEnrollments(data.enrollments);
        }
      } catch (err) {
        console.error("Failed to fetch enrollments:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchEnrollments();
  }, []);

  // Reset to page 1 when search or tab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeTab]);

  // Stats
  const activeCount = enrollments.filter((e) => e.status === "active").length;
  const completedCount = enrollments.filter(
    (e) => e.status === "completed"
  ).length;
  const totalCount = enrollments.length;

  // Filter
  const filteredEnrollments = enrollments.filter((e) => {
    if (activeTab !== "all" && e.status !== activeTab) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const name = (e.userName || "").toLowerCase();
    const email = (e.userEmail || "").toLowerCase();
    const course = (e.courseTitle || "").toLowerCase();
    return name.includes(q) || email.includes(q) || course.includes(q);
  });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredEnrollments.length / perPage));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedEnrollments = filteredEnrollments.slice(
    (safePage - 1) * perPage,
    safePage * perPage
  );

  return (
    <div>
      <h1 className="text-2xl font-bold">Enrollments</h1>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
        Manage student enrollments across courses
      </p>

      {/* Stats Bar */}
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="text-xs font-medium text-[var(--muted-foreground)]">
            Total Enrollments
          </div>
          <div className="mt-1 text-2xl font-bold">{totalCount}</div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="text-xs font-medium text-[var(--muted-foreground)]">
            Active
          </div>
          <div className="mt-1 text-2xl font-bold text-green-600">
            {activeCount}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="text-xs font-medium text-[var(--muted-foreground)]">
            Completed
          </div>
          <div className="mt-1 text-2xl font-bold text-blue-600">
            {completedCount}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--card)] p-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? "bg-[var(--brand-primary)] text-white"
                : "text-[var(--muted-foreground)] hover:bg-[var(--border)]"
            }`}
          >
            {tab.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Search + Per-page controls */}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="text"
          placeholder="Search by student, email, or course..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] sm:max-w-xs"
        />
        <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
          <span>Show</span>
          <select
            value={perPage}
            onChange={(e) => {
              setPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm"
          >
            <option value={10}>10</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span>per page</span>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="mt-8 text-[var(--muted-foreground)]">Loading...</div>
      ) : filteredEnrollments.length === 0 ? (
        <div className="mt-8 text-center text-[var(--muted-foreground)]">
          {searchQuery.trim()
            ? "No results matching your search."
            : `No ${activeTab === "all" ? "" : activeTab.replace("_", " ")} enrollments found.`}
        </div>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[var(--muted-foreground)]">
                  <th className="pb-3 pr-4 font-medium">Student</th>
                  <th className="pb-3 pr-4 font-medium">Course</th>
                  <th className="pb-3 pr-4 font-medium">Status</th>
                  <th className="pb-3 pr-4 font-medium">Progress</th>
                  <th className="pb-3 font-medium">Enrolled</th>
                </tr>
              </thead>
              <tbody>
                {paginatedEnrollments.map((enrollment) => (
                  <tr
                    key={enrollment.id}
                    className="border-b border-[var(--border)] transition-colors hover:bg-[var(--card)]"
                  >
                    <td className="py-3 pr-4">
                      <div className="font-medium">
                        {enrollment.userName || enrollment.userId}
                      </div>
                      {enrollment.userEmail && (
                        <div className="text-xs text-[var(--muted-foreground)]">
                          {enrollment.userEmail}
                        </div>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      {enrollment.courseTitle || enrollment.courseId}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_COLORS[enrollment.status] || ""
                        }`}
                      >
                        {enrollment.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 rounded-full bg-[var(--muted)]">
                          <div
                            className="h-2 rounded-full bg-[var(--brand-primary)]"
                            style={{
                              width: `${enrollment.progress?.percentComplete || 0}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-[var(--muted-foreground)]">
                          {enrollment.progress?.percentComplete || 0}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 text-xs text-[var(--muted-foreground)]">
                      {formatFirestoreDate(enrollment.enrolledAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="mt-4 flex items-center justify-between text-sm">
            <div className="text-[var(--muted-foreground)]">
              Showing {(safePage - 1) * perPage + 1}&ndash;
              {Math.min(safePage * perPage, filteredEnrollments.length)} of{" "}
              {filteredEnrollments.length}
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="rounded-lg border border-[var(--border)] px-3 py-1 text-sm font-medium transition-colors hover:bg-[var(--border)] disabled:opacity-50"
              >
                Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(
                  (p) =>
                    p === 1 ||
                    p === totalPages ||
                    Math.abs(p - safePage) <= 1
                )
                .reduce<(number | "...")[]>((acc, p, i, arr) => {
                  if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("...");
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === "..." ? (
                    <span
                      key={`dot-${i}`}
                      className="px-2 py-1 text-[var(--muted-foreground)]"
                    >
                      ...
                    </span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      className={`rounded-lg border px-3 py-1 text-sm font-medium transition-colors ${
                        p === safePage
                          ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white"
                          : "border-[var(--border)] hover:bg-[var(--border)]"
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={safePage >= totalPages}
                className="rounded-lg border border-[var(--border)] px-3 py-1 text-sm font-medium transition-colors hover:bg-[var(--border)] disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
