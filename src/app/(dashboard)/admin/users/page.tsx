"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface UserItem {
  uid: string;
  email: string;
  displayName: string;
  phone: string | null;
  role: string;
  isExternal: boolean;
  profileComplete: boolean;
  isActive: boolean;
  lastLoginAt: string | null;
}

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-purple-100 text-purple-700",
  institution_admin: "bg-blue-100 text-blue-700",
  instructor: "bg-orange-100 text-orange-700",
};

const MENTOR_ROLES = ["instructor", "institution_admin", "super_admin"];

export default function AdminMentorsPage() {
  const { userData } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch(
          "/api/users?roles=super_admin,institution_admin,instructor"
        );
        if (res.ok) {
          const data = await res.json();
          setUsers(data.users);
        }
      } catch (err) {
        console.error("Failed to fetch mentors:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchUsers();
  }, []);

  async function handleRoleChange(uid: string, newRole: string) {
    setUpdatingUid(uid);

    try {
      const res = await fetch(`/api/users/${uid}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (res.ok) {
        if (newRole === "student") {
          // Remove from mentors list since they're no longer a mentor
          setUsers((prev) => prev.filter((u) => u.uid !== uid));
        } else {
          setUsers((prev) =>
            prev.map((u) => (u.uid === uid ? { ...u, role: newRole } : u))
          );
        }
      }
    } catch (err) {
      console.error("Failed to update role:", err);
    } finally {
      setUpdatingUid(null);
    }
  }

  const isSuperAdmin = userData?.role === "super_admin";
  const availableRoles = isSuperAdmin
    ? MENTOR_ROLES
    : MENTOR_ROLES.filter((r) => r !== "super_admin");

  // Search filter
  const filteredUsers = users.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.displayName?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      (u.phone || "").toLowerCase().includes(q)
    );
  });

  // Stats
  const superAdminCount = users.filter((u) => u.role === "super_admin").length;
  const instAdminCount = users.filter(
    (u) => u.role === "institution_admin"
  ).length;
  const instructorCount = users.filter((u) => u.role === "instructor").length;

  return (
    <div>
      <h1 className="text-2xl font-bold">Mentors</h1>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
        Manage administrators and instructors
      </p>

      {/* Stats */}
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="text-xs font-medium text-[var(--muted-foreground)]">
            Super Admins
          </div>
          <div className="mt-1 text-2xl font-bold text-purple-600">
            {superAdminCount}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="text-xs font-medium text-[var(--muted-foreground)]">
            Institution Admins
          </div>
          <div className="mt-1 text-2xl font-bold text-blue-600">
            {instAdminCount}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="text-xs font-medium text-[var(--muted-foreground)]">
            Instructors
          </div>
          <div className="mt-1 text-2xl font-bold text-orange-600">
            {instructorCount}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="mt-4">
        <input
          type="text"
          placeholder="Search by name, email, or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] sm:max-w-xs"
        />
      </div>

      {loading ? (
        <div className="mt-8 text-[var(--muted-foreground)]">Loading...</div>
      ) : filteredUsers.length === 0 ? (
        <div className="mt-8 text-center text-[var(--muted-foreground)]">
          {searchQuery.trim()
            ? "No results matching your search."
            : "No mentors found."}
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[var(--muted-foreground)]">
                <th className="pb-3 pr-4 font-medium">Name</th>
                <th className="pb-3 pr-4 font-medium">Role</th>
                <th className="pb-3 pr-4 font-medium">Type</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr
                  key={user.uid}
                  className="border-b border-[var(--border)]"
                >
                  <td className="py-3 pr-4">
                    <div className="font-medium">{user.displayName}</div>
                    <div className="text-xs text-[var(--muted-foreground)]">
                      {user.email}
                    </div>
                    {user.phone && (
                      <div className="text-xs text-[var(--muted-foreground)]">
                        {user.phone}
                      </div>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        ROLE_COLORS[user.role] || ""
                      }`}
                    >
                      {user.role.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    {user.isExternal ? (
                      <span className="text-xs text-orange-600">External</span>
                    ) : (
                      <span className="text-xs text-green-600">Domain</span>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`text-xs ${
                        user.isActive ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="py-3">
                    <select
                      value={user.role}
                      onChange={(e) =>
                        handleRoleChange(user.uid, e.target.value)
                      }
                      disabled={updatingUid === user.uid}
                      className="rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs disabled:opacity-50"
                    >
                      {availableRoles.map((role) => (
                        <option key={role} value={role}>
                          {role.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
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
