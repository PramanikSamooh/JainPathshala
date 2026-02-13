"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Session {
  id: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  topic: string;
  meetingPlatform: string;
  meetLink: string | null;
  calendarEventId: string | null;
  zoomMeetingId: number | null;
  zoomMeetingUuid: string | null;
  attendeeCount: number;
}

export default function SessionsPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    sessionDate: "",
    startTime: "18:00",
    endTime: "19:30",
    topic: "",
    meetingPlatform: "google_meet",
    customMeetLink: "",
  });

  useEffect(() => {
    fetchSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  async function fetchSessions() {
    try {
      const res = await fetch(`/api/courses/${courseId}/sessions`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (err) {
      console.error("Failed to fetch sessions:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        setShowForm(false);
        setEditingId(null);
        setForm({ sessionDate: "", startTime: "18:00", endTime: "19:30", topic: "", meetingPlatform: "google_meet", customMeetLink: "" });
        await fetchSessions();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create session");
      }
    } catch (err) {
      console.error("Failed to create session:", err);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(sessionId: string) {
    if (!confirm("Delete this session? The associated Calendar event or Zoom meeting will also be removed.")) {
      return;
    }
    setDeletingId(sessionId);
    try {
      const res = await fetch(`/api/courses/${courseId}/sessions`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      if (res.ok) {
        await fetchSessions();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete session");
      }
    } catch (err) {
      console.error("Failed to delete session:", err);
    } finally {
      setDeletingId(null);
    }
  }

  function handleEdit(session: Session) {
    setForm({
      sessionDate: session.sessionDate,
      startTime: session.startTime,
      endTime: session.endTime,
      topic: session.topic,
      meetingPlatform: session.meetingPlatform || "google_meet",
      customMeetLink: session.meetingPlatform !== "google_meet" ? (session.meetLink || "") : "",
    });
    setEditingId(session.id);
    setShowForm(true);
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setCreating(true);
    try {
      // Delete old session, create new one (preserves calendar sync)
      const delRes = await fetch(`/api/courses/${courseId}/sessions`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: editingId }),
      });

      if (!delRes.ok) {
        const data = await delRes.json();
        alert(data.error || "Failed to update session");
        return;
      }

      const createRes = await fetch(`/api/courses/${courseId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (createRes.ok) {
        setShowForm(false);
        setEditingId(null);
        setForm({ sessionDate: "", startTime: "18:00", endTime: "19:30", topic: "", meetingPlatform: "google_meet", customMeetLink: "" });
        await fetchSessions();
      } else {
        const data = await createRes.json();
        alert(data.error || "Failed to update session");
      }
    } catch (err) {
      console.error("Failed to update session:", err);
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-[var(--muted-foreground)]">Loading sessions...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Bootcamp Sessions</h1>
        <button
          onClick={() => {
            if (showForm) {
              setShowForm(false);
              setEditingId(null);
              setForm({ sessionDate: "", startTime: "18:00", endTime: "19:30", topic: "", meetingPlatform: "google_meet", customMeetLink: "" });
            } else {
              setShowForm(true);
            }
          }}
          className="rounded-lg px-4 py-2 text-sm text-white"
          style={{ backgroundColor: "var(--brand-primary)" }}
        >
          {showForm ? "Cancel" : "+ New Session"}
        </button>
      </div>

      {/* Create session form */}
      {showForm && (
        <form onSubmit={editingId ? handleUpdate : handleCreate} className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Date</label>
              <input
                type="date"
                required
                value={form.sessionDate}
                onChange={(e) => setForm({ ...form, sessionDate: e.target.value })}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Topic</label>
              <input
                type="text"
                required
                value={form.topic}
                onChange={(e) => setForm({ ...form, topic: e.target.value })}
                placeholder="Session topic"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Start Time</label>
              <input
                type="time"
                required
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">End Time</label>
              <input
                type="time"
                required
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Meeting Platform</label>
              <select
                value={form.meetingPlatform}
                onChange={(e) => setForm({ ...form, meetingPlatform: e.target.value, customMeetLink: "" })}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              >
                <option value="google_meet">Google Meet (auto-create)</option>
                <option value="zoom">Zoom (auto-create)</option>
                <option value="ms_teams">Microsoft Teams</option>
                <option value="custom_link">Custom Link</option>
              </select>
            </div>
            {form.meetingPlatform === "zoom" && (
              <div className="flex items-center">
                <p className="text-xs text-[var(--muted-foreground)]">
                  Zoom meeting will be created automatically with registration enabled. Enrolled students will be pre-registered.
                </p>
              </div>
            )}
            {!["google_meet", "zoom"].includes(form.meetingPlatform) && (
              <div>
                <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Meeting Link</label>
                <input
                  type="url"
                  value={form.customMeetLink}
                  onChange={(e) => setForm({ ...form, customMeetLink: e.target.value })}
                  placeholder={
                    form.meetingPlatform === "ms_teams"
                      ? "https://teams.microsoft.com/..."
                      : "https://..."
                  }
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                />
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg px-4 py-2 text-sm text-white disabled:opacity-50"
            style={{ backgroundColor: "var(--brand-primary)" }}
          >
            {creating
              ? editingId ? "Updating..." : "Creating..."
              : editingId ? "Update Session" : "Create Session"}
          </button>
        </form>
      )}

      {/* Sessions list */}
      {sessions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center">
          <p className="text-[var(--muted-foreground)]">No sessions created yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 flex items-center justify-between"
            >
              <div>
                <h3 className="font-semibold text-sm">{session.topic}</h3>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  {session.sessionDate} &middot; {session.startTime} - {session.endTime}
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {session.attendeeCount} attendees
                </p>
              </div>
              <div className="flex items-center gap-2">
                {session.meetLink ? (
                  <a
                    href={session.meetLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium text-white ${
                      session.meetingPlatform === "zoom"
                        ? "bg-[#2D8CFF] hover:bg-[#2681ED]"
                        : "bg-blue-600 hover:bg-blue-700"
                    }`}
                  >
                    {session.meetingPlatform === "zoom" ? "Join Zoom" : "Join Meet"}
                  </a>
                ) : (
                  <span className="text-xs text-[var(--muted-foreground)]">No meeting link</span>
                )}
                {session.zoomMeetingId && (
                  <span className="rounded bg-[var(--muted)] px-2 py-0.5 text-xs text-[var(--muted-foreground)]">
                    Zoom #{session.zoomMeetingId}
                  </span>
                )}
                <button
                  onClick={() => handleEdit(session)}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-[var(--muted)]"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(session.id)}
                  disabled={deletingId === session.id}
                  className="rounded-lg border border-red-300 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  {deletingId === session.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
