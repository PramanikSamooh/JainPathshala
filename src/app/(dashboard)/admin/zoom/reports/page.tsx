"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface MeetingSummary {
  id: string;
  topic: string;
  startTime: string;
  duration: number;
  status: string;
  participantCount: number;
  registrantCount: number;
  courseId: string | null;
}

interface ReportSummary {
  totalMeetings: number;
  completedMeetings: number;
  totalParticipants: number;
  totalRegistrants: number;
  avgParticipantsPerMeeting: number;
}

export default function ZoomReportsPage() {
  const [meetings, setMeetings] = useState<MeetingSummary[]>([]);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split("T")[0];
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split("T")[0]);

  async function fetchReports() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from: fromDate, to: toDate });
      const res = await fetch(`/api/zoom/reports?${params}`);
      if (res.ok) {
        const data = await res.json();
        setMeetings(data.meetings || []);
        setSummary(data.summary || null);
      }
    } catch (err) {
      console.error("Failed to fetch reports:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchReports();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function exportCsv() {
    if (meetings.length === 0) return;
    const headers = [
      "Topic",
      "Date",
      "Duration (min)",
      "Status",
      "Participants",
      "Registrants",
    ];
    const rows = meetings.map((m) => [
      `"${m.topic}"`,
      new Date(m.startTime).toLocaleDateString("en-IN"),
      m.duration,
      m.status,
      m.participantCount,
      m.registrantCount,
    ]);

    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zoom-reports-${fromDate}-to-${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/admin/zoom"
            className="text-sm text-[var(--muted-foreground)] hover:underline"
          >
            &larr; Back to Zoom Meetings
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Zoom Reports</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Meeting analytics and attendance summaries
          </p>
        </div>
        <button
          onClick={exportCsv}
          className="rounded-lg bg-[var(--muted)] px-4 py-2 text-sm text-[var(--muted-foreground)] hover:bg-[var(--border)]"
        >
          Export CSV
        </button>
      </div>

      {/* Date Range Filter */}
      <div className="mt-6 flex items-end gap-4">
        <div>
          <label className="block text-sm font-medium">From</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="mt-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">To</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="mt-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={fetchReports}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: "var(--brand-primary)" }}
        >
          Apply
        </button>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl bg-blue-50 p-4 text-blue-700">
            <div className="text-xs font-medium opacity-80">Total Meetings</div>
            <div className="mt-1 text-xl font-bold">{summary.totalMeetings}</div>
          </div>
          <div className="rounded-xl bg-green-50 p-4 text-green-700">
            <div className="text-xs font-medium opacity-80">Completed</div>
            <div className="mt-1 text-xl font-bold">{summary.completedMeetings}</div>
          </div>
          <div className="rounded-xl bg-purple-50 p-4 text-purple-700">
            <div className="text-xs font-medium opacity-80">Total Participants</div>
            <div className="mt-1 text-xl font-bold">{summary.totalParticipants}</div>
          </div>
          <div className="rounded-xl bg-orange-50 p-4 text-orange-700">
            <div className="text-xs font-medium opacity-80">Total Registrants</div>
            <div className="mt-1 text-xl font-bold">{summary.totalRegistrants}</div>
          </div>
          <div className="rounded-xl bg-teal-50 p-4 text-teal-700">
            <div className="text-xs font-medium opacity-80">Avg Participants</div>
            <div className="mt-1 text-xl font-bold">{summary.avgParticipantsPerMeeting}</div>
          </div>
        </div>
      )}

      {/* Meetings Table */}
      {loading ? (
        <div className="mt-8 text-[var(--muted-foreground)]">Loading...</div>
      ) : meetings.length === 0 ? (
        <div className="mt-8 text-center text-[var(--muted-foreground)]">
          No meetings found in the selected date range.
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--muted)]">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Topic</th>
                <th className="px-4 py-2 text-left font-medium">Date</th>
                <th className="px-4 py-2 text-left font-medium">Duration</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Participants</th>
                <th className="px-4 py-2 text-left font-medium">Registrants</th>
                <th className="px-4 py-2 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {meetings.map((m) => (
                <tr key={m.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-2 font-medium">{m.topic}</td>
                  <td className="px-4 py-2">
                    {new Date(m.startTime).toLocaleDateString("en-IN", {
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-2">{m.duration} min</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        m.status === "ended"
                          ? "bg-gray-100 text-gray-700"
                          : m.status === "started"
                          ? "bg-green-100 text-green-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {m.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">{m.participantCount}</td>
                  <td className="px-4 py-2">{m.registrantCount}</td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/admin/zoom/meetings/${m.id}`}
                      className="text-[var(--brand-primary)] hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
