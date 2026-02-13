"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface MeetingDetail {
  id: string;
  topic: string;
  startTime: string;
  endTime: string;
  duration: number;
  timezone: string;
  joinUrl: string;
  startUrl: string;
  password: string;
  zoomMeetingId: number;
  status: string;
  participantCount: number;
  registrantCount: number;
  liveParticipantCount: number;
  courseId: string | null;
  sessionId: string | null;
}

interface Participant {
  id: string;
  userName: string;
  email: string;
  joinTime: string;
  leaveTime?: string;
  status: string;
}

interface Registrant {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  status: string;
  join_url: string;
}

interface ReportParticipant {
  name: string;
  user_email: string;
  join_time: string;
  leave_time: string;
  duration: number;
  durationMinutes: number;
  isRegistered: boolean;
  platformUser: { uid: string; displayName: string; role: string } | null;
}

export default function ZoomMeetingDetailPage() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const router = useRouter();
  const [meeting, setMeeting] = useState<MeetingDetail | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [registrants, setRegistrants] = useState<Registrant[]>([]);
  const [reportParticipants, setReportParticipants] = useState<ReportParticipant[]>([]);
  const [reportSummary, setReportSummary] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"live" | "registrants" | "report">("live");
  const [addEmail, setAddEmail] = useState("");
  const [addFirstName, setAddFirstName] = useState("");
  const [addLastName, setAddLastName] = useState("");
  const [addingRegistrant, setAddingRegistrant] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [meetingRes, registrantsRes] = await Promise.all([
          fetch(`/api/zoom/meetings/${meetingId}`),
          fetch(`/api/zoom/meetings/${meetingId}/registrants`),
        ]);

        if (meetingRes.ok) {
          const data = await meetingRes.json();
          setMeeting(data.meeting);
          setParticipants(data.participants || []);
        }
        if (registrantsRes.ok) {
          const data = await registrantsRes.json();
          setRegistrants(data.registrants || []);
        }
      } catch (err) {
        console.error("Failed to fetch meeting:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [meetingId]);

  async function fetchReport() {
    try {
      const res = await fetch(`/api/zoom/meetings/${meetingId}/report`);
      if (res.ok) {
        const data = await res.json();
        setReportParticipants(data.report.participants || []);
        setReportSummary(data.summary || null);
        setActiveTab("report");
      }
    } catch (err) {
      console.error("Failed to fetch report:", err);
    }
  }

  async function handleAddRegistrant(e: React.FormEvent) {
    e.preventDefault();
    if (!addEmail || !addFirstName || !addLastName) return;

    setAddingRegistrant(true);
    try {
      const res = await fetch(`/api/zoom/meetings/${meetingId}/registrants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: addEmail,
          firstName: addFirstName,
          lastName: addLastName,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setRegistrants((prev) => [...prev, data.registrant]);
        setAddEmail("");
        setAddFirstName("");
        setAddLastName("");
      } else {
        const err = await res.json();
        alert(err.error || "Failed to add registrant");
      }
    } catch (err) {
      console.error("Add registrant failed:", err);
    } finally {
      setAddingRegistrant(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this meeting?")) return;
    try {
      const res = await fetch(`/api/zoom/meetings/${meetingId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push("/admin/zoom");
      }
    } catch (err) {
      console.error("Delete failed:", err);
    }
  }

  function exportCsv() {
    if (reportParticipants.length === 0) return;
    const headers = ["Name", "Email", "Join Time", "Leave Time", "Duration (min)", "Platform User", "Registered"];
    const rows = reportParticipants.map((p) => [
      p.name,
      p.user_email,
      new Date(p.join_time).toLocaleString("en-IN"),
      new Date(p.leave_time).toLocaleString("en-IN"),
      p.durationMinutes,
      p.platformUser?.displayName || "N/A",
      p.isRegistered ? "Yes" : "No",
    ]);

    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zoom-report-${meetingId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-[var(--muted-foreground)]">Loading meeting details...</div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-[var(--muted-foreground)]">Meeting not found</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/zoom" className="text-sm text-[var(--muted-foreground)] hover:underline">
            &larr; Back to Zoom Meetings
          </Link>
          <h1 className="mt-2 text-2xl font-bold">{meeting.topic}</h1>
        </div>
        <div className="flex gap-2">
          {meeting.status === "ended" && (
            <button
              onClick={fetchReport}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: "var(--brand-primary)" }}
            >
              View Report
            </button>
          )}
          <button
            onClick={handleDelete}
            className="rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Meeting Info Card */}
      <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="text-xs text-[var(--muted-foreground)]">Date & Time</div>
            <div className="mt-1 text-sm font-medium">
              {new Date(meeting.startTime).toLocaleString("en-IN", {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
          <div>
            <div className="text-xs text-[var(--muted-foreground)]">Duration</div>
            <div className="mt-1 text-sm font-medium">{meeting.duration} minutes</div>
          </div>
          <div>
            <div className="text-xs text-[var(--muted-foreground)]">Zoom Meeting ID</div>
            <div className="mt-1 text-sm font-medium">{meeting.zoomMeetingId}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--muted-foreground)]">Password</div>
            <div className="mt-1 text-sm font-medium">{meeting.password || "N/A"}</div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <a
            href={meeting.joinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-white"
            style={{ backgroundColor: "#2D8CFF" }}
          >
            Join Meeting
          </a>
          <button
            onClick={() => navigator.clipboard.writeText(meeting.joinUrl)}
            className="rounded-lg bg-[var(--muted)] px-3 py-1.5 text-sm text-[var(--muted-foreground)] hover:bg-[var(--border)]"
          >
            Copy Link
          </button>
          <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${
            meeting.status === "started"
              ? "bg-green-100 text-green-700"
              : meeting.status === "ended"
              ? "bg-gray-100 text-gray-700"
              : "bg-blue-100 text-blue-700"
          }`}>
            {meeting.status}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex gap-2">
        {(["live", "registrants", "report"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              if (t === "report" && reportParticipants.length === 0) {
                fetchReport();
              } else {
                setActiveTab(t);
              }
            }}
            className={`rounded-lg px-3 py-1.5 text-sm capitalize ${
              activeTab === t
                ? "bg-[var(--brand-primary)] text-white"
                : "bg-[var(--muted)] text-[var(--muted-foreground)]"
            }`}
          >
            {t === "live"
              ? `Live (${participants.filter((p) => p.status === "in_meeting").length})`
              : t === "registrants"
              ? `Registrants (${registrants.length})`
              : "Report"}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-4">
        {activeTab === "live" && (
          <div className="space-y-2">
            {participants.length === 0 ? (
              <div className="py-8 text-center text-[var(--muted-foreground)]">
                No participants yet. Data appears when the meeting starts.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--muted)]">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Name</th>
                      <th className="px-4 py-2 text-left font-medium">Email</th>
                      <th className="px-4 py-2 text-left font-medium">Joined</th>
                      <th className="px-4 py-2 text-left font-medium">Left</th>
                      <th className="px-4 py-2 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {participants.map((p) => (
                      <tr key={p.id} className="border-t border-[var(--border)]">
                        <td className="px-4 py-2">{p.userName}</td>
                        <td className="px-4 py-2">{p.email || "N/A"}</td>
                        <td className="px-4 py-2">
                          {new Date(p.joinTime).toLocaleTimeString("en-IN")}
                        </td>
                        <td className="px-4 py-2">
                          {p.leaveTime
                            ? new Date(p.leaveTime).toLocaleTimeString("en-IN")
                            : "—"}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              p.status === "in_meeting"
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {p.status === "in_meeting" ? "In Meeting" : "Left"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "registrants" && (
          <div>
            {/* Add Registrant Form */}
            <form onSubmit={handleAddRegistrant} className="mb-4 flex gap-2">
              <input
                type="email"
                placeholder="Email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                required
              />
              <input
                type="text"
                placeholder="First name"
                value={addFirstName}
                onChange={(e) => setAddFirstName(e.target.value)}
                className="w-32 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                required
              />
              <input
                type="text"
                placeholder="Last name"
                value={addLastName}
                onChange={(e) => setAddLastName(e.target.value)}
                className="w-32 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                required
              />
              <button
                type="submit"
                disabled={addingRegistrant}
                className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: "var(--brand-primary)" }}
              >
                {addingRegistrant ? "Adding..." : "Add"}
              </button>
            </form>

            {registrants.length === 0 ? (
              <div className="py-8 text-center text-[var(--muted-foreground)]">
                No registrants yet.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--muted)]">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Name</th>
                      <th className="px-4 py-2 text-left font-medium">Email</th>
                      <th className="px-4 py-2 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrants.map((r) => (
                      <tr key={r.id} className="border-t border-[var(--border)]">
                        <td className="px-4 py-2">
                          {r.first_name} {r.last_name}
                        </td>
                        <td className="px-4 py-2">{r.email}</td>
                        <td className="px-4 py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              r.status === "approved"
                                ? "bg-green-100 text-green-700"
                                : r.status === "pending"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "report" && (
          <div>
            {reportSummary && (
              <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl bg-blue-50 p-4 text-blue-700">
                  <div className="text-xs font-medium opacity-80">Total Participants</div>
                  <div className="mt-1 text-xl font-bold">{reportSummary.totalParticipants}</div>
                </div>
                <div className="rounded-xl bg-green-50 p-4 text-green-700">
                  <div className="text-xs font-medium opacity-80">Registered Users</div>
                  <div className="mt-1 text-xl font-bold">{reportSummary.registeredUsers}</div>
                </div>
                <div className="rounded-xl bg-orange-50 p-4 text-orange-700">
                  <div className="text-xs font-medium opacity-80">Unregistered</div>
                  <div className="mt-1 text-xl font-bold">{reportSummary.unregisteredUsers}</div>
                </div>
                <div className="rounded-xl bg-purple-50 p-4 text-purple-700">
                  <div className="text-xs font-medium opacity-80">Avg Duration</div>
                  <div className="mt-1 text-xl font-bold">{reportSummary.avgDurationMinutes} min</div>
                </div>
              </div>
            )}

            <div className="mb-3 flex justify-end">
              <button
                onClick={exportCsv}
                className="rounded-lg bg-[var(--muted)] px-3 py-1.5 text-sm text-[var(--muted-foreground)] hover:bg-[var(--border)]"
              >
                Export CSV
              </button>
            </div>

            {reportParticipants.length === 0 ? (
              <div className="py-8 text-center text-[var(--muted-foreground)]">
                No report data available. Report is available after the meeting ends.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--muted)]">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Name</th>
                      <th className="px-4 py-2 text-left font-medium">Email</th>
                      <th className="px-4 py-2 text-left font-medium">Join Time</th>
                      <th className="px-4 py-2 text-left font-medium">Leave Time</th>
                      <th className="px-4 py-2 text-left font-medium">Duration</th>
                      <th className="px-4 py-2 text-left font-medium">Registered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportParticipants.map((p, i) => (
                      <tr key={i} className="border-t border-[var(--border)]">
                        <td className="px-4 py-2">
                          {p.platformUser?.displayName || p.name}
                        </td>
                        <td className="px-4 py-2">{p.user_email}</td>
                        <td className="px-4 py-2">
                          {new Date(p.join_time).toLocaleTimeString("en-IN")}
                        </td>
                        <td className="px-4 py-2">
                          {new Date(p.leave_time).toLocaleTimeString("en-IN")}
                        </td>
                        <td className="px-4 py-2">{p.durationMinutes} min</td>
                        <td className="px-4 py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              p.isRegistered
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {p.isRegistered ? "Yes" : "No"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
