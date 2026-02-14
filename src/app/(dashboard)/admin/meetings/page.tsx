"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/* ---------- Types ---------- */

type MeetingProvider = "zoom" | "google_meet";

interface ZoomMeetingItem {
  id: string;
  topic: string;
  startTime: string;
  endTime: string;
  duration: number;
  status: "scheduled" | "started" | "ended" | "cancelled";
  joinUrl: string;
  participantCount: number;
  registrantCount: number;
  courseId: string | null;
  liveParticipantCount?: number;
}

/* ---------- Constants ---------- */

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  started: "bg-green-100 text-green-700",
  ended: "bg-gray-100 text-gray-700",
  cancelled: "bg-red-100 text-red-700",
};

/* ---------- Page ---------- */

export default function AdminMeetingsPage() {
  const [provider, setProvider] = useState<MeetingProvider>("zoom");

  return (
    <div>
      <h1 className="text-2xl font-bold">Meetings</h1>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
        Manage online meetings across platforms
      </p>

      {/* Provider Toggle */}
      <div className="mt-4 flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--card)] p-1 w-fit">
        <button
          onClick={() => setProvider("zoom")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            provider === "zoom"
              ? "bg-[var(--brand-primary)] text-white"
              : "text-[var(--muted-foreground)] hover:bg-[var(--border)]"
          }`}
        >
          Zoom
        </button>
        <button
          onClick={() => setProvider("google_meet")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            provider === "google_meet"
              ? "bg-[var(--brand-primary)] text-white"
              : "text-[var(--muted-foreground)] hover:bg-[var(--border)]"
          }`}
        >
          Google Meet
        </button>
      </div>

      {provider === "zoom" ? <ZoomSection /> : <GoogleMeetSection />}
    </div>
  );
}

/* ---------- Zoom Section ---------- */

function ZoomSection() {
  const [meetings, setMeetings] = useState<ZoomMeetingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    async function fetchMeetings() {
      try {
        const res = await fetch("/api/zoom/meetings?limit=100");
        if (res.ok) {
          const data = await res.json();
          setMeetings(data.meetings || []);
        }
      } catch (err) {
        console.error("Failed to fetch Zoom meetings:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchMeetings();
  }, []);

  const upcoming = meetings.filter(
    (m) => m.status === "scheduled" || m.status === "started"
  );
  const past = meetings.filter(
    (m) => m.status === "ended" || m.status === "cancelled"
  );
  const filtered = tab === "upcoming" ? upcoming : past;

  const totalMeetings = meetings.length;
  const totalParticipants = meetings.reduce(
    (sum, m) => sum + (m.participantCount || 0),
    0
  );
  const completedMeetings = past.filter((m) => m.status === "ended").length;

  function refetchMeetings() {
    fetch("/api/zoom/meetings?limit=100")
      .then((res) => res.json())
      .then((data) => setMeetings(data.meetings || []))
      .catch(console.error);
  }

  if (loading) {
    return (
      <div className="mt-8 text-[var(--muted-foreground)]">
        Loading Zoom meetings...
      </div>
    );
  }

  return (
    <>
      {/* Action bar */}
      <div className="mt-6 flex items-center justify-end">
        <button
          onClick={() => setShowCreateForm(true)}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: "var(--brand-primary)" }}
        >
          + New Meeting
        </button>
      </div>

      {/* Stats */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-blue-50 p-5 text-blue-700">
          <div className="text-sm font-medium opacity-80">Total Meetings</div>
          <div className="mt-1 text-2xl font-bold">{totalMeetings}</div>
        </div>
        <div className="rounded-xl bg-green-50 p-5 text-green-700">
          <div className="text-sm font-medium opacity-80">Upcoming</div>
          <div className="mt-1 text-2xl font-bold">{upcoming.length}</div>
        </div>
        <div className="rounded-xl bg-purple-50 p-5 text-purple-700">
          <div className="text-sm font-medium opacity-80">Completed</div>
          <div className="mt-1 text-2xl font-bold">{completedMeetings}</div>
        </div>
        <div className="rounded-xl bg-orange-50 p-5 text-orange-700">
          <div className="text-sm font-medium opacity-80">
            Total Participants
          </div>
          <div className="mt-1 text-2xl font-bold">{totalParticipants}</div>
        </div>
      </div>

      {/* Tab Filters */}
      <div className="mt-6 flex gap-2">
        {(["upcoming", "past"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-sm capitalize ${
              tab === t
                ? "bg-[var(--brand-primary)] text-white"
                : "bg-[var(--muted)] text-[var(--muted-foreground)]"
            }`}
          >
            {t} ({t === "upcoming" ? upcoming.length : past.length})
          </button>
        ))}
        <Link
          href="/admin/zoom/reports"
          className="ml-auto rounded-lg bg-[var(--muted)] px-3 py-1.5 text-sm text-[var(--muted-foreground)] hover:bg-[var(--border)]"
        >
          View Reports
        </Link>
      </div>

      {/* Meeting List */}
      <div className="mt-4 space-y-3">
        {filtered.length === 0 ? (
          <div className="mt-8 text-center text-[var(--muted-foreground)]">
            No {tab} meetings found.
          </div>
        ) : (
          filtered.map((meeting) => (
            <Link
              key={meeting.id}
              href={`/admin/zoom/meetings/${meeting.id}`}
              className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 transition hover:shadow-sm"
            >
              <div>
                <div className="font-medium">{meeting.topic}</div>
                <div className="mt-1 flex items-center gap-3 text-sm text-[var(--muted-foreground)]">
                  <span>
                    {new Date(meeting.startTime).toLocaleDateString("en-IN", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span>
                    {new Date(meeting.startTime).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span>{meeting.duration} min</span>
                  {meeting.registrantCount > 0 && (
                    <span className="rounded bg-[var(--muted)] px-2 py-0.5 text-xs">
                      {meeting.registrantCount} registered
                    </span>
                  )}
                  {meeting.status === "started" &&
                    meeting.liveParticipantCount !== undefined && (
                      <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
                        {meeting.liveParticipantCount} live
                      </span>
                    )}
                </div>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[meeting.status]}`}
              >
                {meeting.status}
              </span>
            </Link>
          ))
        )}
      </div>

      {/* Create Meeting Modal */}
      {showCreateForm && (
        <CreateZoomModal
          onClose={() => setShowCreateForm(false)}
          onCreated={() => {
            setShowCreateForm(false);
            refetchMeetings();
          }}
        />
      )}
    </>
  );
}

/* ---------- Create Zoom Modal ---------- */

function CreateZoomModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [topic, setTopic] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTimeVal, setStartTimeVal] = useState("");
  const [duration, setDuration] = useState(60);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!topic || !startDate || !startTimeVal) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/zoom/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          startTime: `${startDate}T${startTimeVal}:00`,
          duration,
          timezone: "Asia/Kolkata",
          registrationRequired: true,
        }),
      });

      if (res.ok) {
        onCreated();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to create meeting");
      }
    } catch (err) {
      console.error("Create meeting failed:", err);
      alert("Failed to create meeting");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-[var(--card)] p-6 shadow-lg">
        <h2 className="text-lg font-semibold">Create Zoom Meeting</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium">Topic</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium">Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Time</label>
              <input
                type="time"
                value={startTimeVal}
                onChange={(e) => setStartTimeVal(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium">
              Duration (minutes)
            </label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              min={15}
              max={1440}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: "var(--brand-primary)" }}
            >
              {submitting ? "Creating..." : "Create Meeting"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------- Google Meet Section (Placeholder) ---------- */

function GoogleMeetSection() {
  return (
    <div className="mt-8 flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] p-12">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-blue-500"
        >
          <path d="m15.2 8.8 4.4-2.63A.5.5 0 0 1 20.5 6.5v11a.5.5 0 0 1-.9.32L15.2 15.2" />
          <rect width="14" height="12" x="1" y="6" rx="2" />
        </svg>
      </div>
      <h3 className="mt-4 text-lg font-semibold">Google Meet</h3>
      <p className="mt-2 text-center text-sm text-[var(--muted-foreground)]">
        Google Meet integration is coming soon. You will be able to create and
        manage Google Meet sessions directly from here.
      </p>
      <span className="mt-4 rounded-full bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-600">
        Coming Soon
      </span>
    </div>
  );
}
