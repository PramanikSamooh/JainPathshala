"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

interface InstructorOption {
  uid: string;
  displayName: string;
  email: string;
}

export default function InstructorManagementPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const { firebaseUser } = useAuth();
  const [allInstructors, setAllInstructors] = useState<InstructorOption[]>([]);
  const [assignedIds, setAssignedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function fetchData() {
      try {
        const [courseRes, usersRes] = await Promise.all([
          fetch(`/api/courses/${courseId}`),
          fetch("/api/users?role=instructor"),
        ]);

        if (courseRes.ok) {
          const courseData = await courseRes.json();
          setAssignedIds(courseData.instructorIds || []);
        }

        if (usersRes.ok) {
          const usersData = await usersRes.json();
          setAllInstructors(usersData.users || []);
        }
      } catch (err) {
        console.error("Failed to load data:", err);
      } finally {
        setLoading(false);
      }
    }
    if (courseId) fetchData();
  }, [courseId]);

  function toggleInstructor(uid: string, checked: boolean) {
    // Prevent self-removal
    if (!checked && uid === firebaseUser?.uid) {
      setMessage("You cannot remove yourself from this course");
      return;
    }

    if (checked) {
      setAssignedIds((prev) => [...prev, uid]);
    } else {
      setAssignedIds((prev) => prev.filter((id) => id !== uid));
    }
    setMessage(null);
  }

  async function handleSave() {
    if (assignedIds.length === 0) {
      setMessage("At least one instructor must be assigned");
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/courses/${courseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructorIds: assignedIds }),
      });
      if (res.ok) {
        setMessage("Instructors updated successfully");
      } else {
        const data = await res.json();
        setMessage(`Error: ${data.error}`);
      }
    } catch {
      setMessage("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const filteredInstructors = allInstructors.filter((inst) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      inst.displayName?.toLowerCase().includes(q) ||
      inst.email?.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-[var(--muted-foreground)]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-bold">Manage Instructors</h2>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
        {assignedIds.length} instructor{assignedIds.length !== 1 ? "s" : ""}{" "}
        assigned to this course
      </p>

      {message && (
        <div
          className={`mt-4 rounded-lg p-3 text-sm ${
            message.startsWith("Error") || message.startsWith("You cannot") || message.startsWith("At least")
              ? "bg-red-50 text-red-600"
              : "bg-green-50 text-green-600"
          }`}
        >
          {message}
        </div>
      )}

      {/* Search */}
      <div className="mt-4">
        <input
          type="text"
          placeholder="Search instructors..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] sm:max-w-xs"
        />
      </div>

      {/* Instructor list */}
      <div className="mt-4 rounded-lg border border-[var(--border)] p-4">
        {filteredInstructors.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">
            {searchQuery.trim()
              ? "No instructors matching your search."
              : "No instructors found in your institution."}
          </p>
        ) : (
          <div className="space-y-3">
            {filteredInstructors.map((inst) => {
              const isSelf = inst.uid === firebaseUser?.uid;
              const isAssigned = assignedIds.includes(inst.uid);
              return (
                <label
                  key={inst.uid}
                  className={`flex items-center gap-3 rounded-lg p-2 transition ${
                    isAssigned
                      ? "bg-[var(--brand-primary)]/5"
                      : "hover:bg-[var(--muted)]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isAssigned}
                    onChange={(e) => toggleInstructor(inst.uid, e.target.checked)}
                    disabled={isSelf && isAssigned}
                    className="h-4 w-4"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">
                      {inst.displayName || inst.email}
                      {isSelf && (
                        <span className="ml-2 text-xs text-[var(--muted-foreground)]">
                          (you)
                        </span>
                      )}
                    </div>
                    {inst.displayName && (
                      <div className="text-xs text-[var(--muted-foreground)]">
                        {inst.email}
                      </div>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-4 rounded-lg px-6 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        style={{ backgroundColor: "var(--brand-primary)" }}
      >
        {saving ? "Saving..." : "Save Changes"}
      </button>
    </div>
  );
}
