"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

interface InstitutionBranding {
  tagline?: string;
}

interface InstitutionLocation {
  city?: string;
  state?: string;
  country?: string;
}

interface BrowseInstitution {
  id: string;
  name: string;
  location?: InstitutionLocation;
  branding?: InstitutionBranding;
}

type CardStatus = "idle" | "joining" | "entering_code" | "submitting_code" | "success" | "error";

interface CardState {
  status: CardStatus;
  inviteCode: string;
  error: string | null;
}

export default function SelectInstitutionPage() {
  const { memberships, needsInstitutionSelection, loading: authLoading } = useAuth();
  const router = useRouter();

  const [institutions, setInstitutions] = useState<BrowseInstitution[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Per-card state keyed by institution id
  const [cardStates, setCardStates] = useState<Record<string, CardState>>({});

  // Filters
  const [countryFilter, setCountryFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");

  // Redirect if user already has approved memberships
  useEffect(() => {
    if (!authLoading && !needsInstitutionSelection) {
      const hasApproved = memberships.some((m) => m.status === "approved");
      if (hasApproved) {
        router.push("/dashboard");
      }
    }
  }, [authLoading, needsInstitutionSelection, memberships, router]);

  // Fetch browseable institutions
  useEffect(() => {
    async function fetchInstitutions() {
      try {
        const res = await fetch("/api/institutions?browse=true");
        if (!res.ok) {
          throw new Error("Failed to load institutions");
        }
        const data = await res.json();
        setInstitutions(data.institutions || []);
      } catch (err) {
        console.error("Failed to fetch institutions:", err);
        setFetchError("Could not load institutions. Please try again later.");
      } finally {
        setLoading(false);
      }
    }

    fetchInstitutions();
  }, []);

  function getCardState(institutionId: string): CardState {
    return cardStates[institutionId] || { status: "idle", inviteCode: "", error: null };
  }

  function updateCardState(institutionId: string, updates: Partial<CardState>) {
    setCardStates((prev) => ({
      ...prev,
      [institutionId]: { ...getCardState(institutionId), ...updates },
    }));
  }

  // Check if user already has a pending/approved membership for this institution
  function existingMembershipStatus(institutionId: string): string | null {
    const existing = memberships.find((m) => m.institutionId === institutionId);
    return existing?.status || null;
  }

  async function handleJoin(institutionId: string) {
    updateCardState(institutionId, { status: "joining", error: null });

    try {
      const res = await fetch("/api/memberships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ institutionId, joinMethod: "browse" }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit request");
      }

      updateCardState(institutionId, { status: "success" });
    } catch (err) {
      updateCardState(institutionId, {
        status: "error",
        error: err instanceof Error ? err.message : "Something went wrong",
      });
    }
  }

  async function handleJoinWithCode(institutionId: string) {
    const state = getCardState(institutionId);
    const code = state.inviteCode.trim();

    if (!code) {
      updateCardState(institutionId, { error: "Please enter an invite code" });
      return;
    }

    updateCardState(institutionId, { status: "submitting_code", error: null });

    try {
      const res = await fetch("/api/memberships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          institutionId,
          joinMethod: "invite_code",
          inviteCode: code,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit request");
      }

      updateCardState(institutionId, { status: "success" });
    } catch (err) {
      updateCardState(institutionId, {
        status: "entering_code",
        error: err instanceof Error ? err.message : "Something went wrong",
      });
    }
  }

  // Apply client-side filters
  const filteredInstitutions = institutions.filter((inst) => {
    const country = inst.location?.country?.toLowerCase() || "";
    const state = inst.location?.state?.toLowerCase() || "";

    if (countryFilter && !country.includes(countryFilter.toLowerCase())) {
      return false;
    }
    if (stateFilter && !state.includes(stateFilter.toLowerCase())) {
      return false;
    }
    return true;
  });

  // Loading state
  if (authLoading || loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-[var(--muted-foreground)]">Loading institutions...</div>
      </div>
    );
  }

  // Fetch error state
  if (fetchError) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <p className="text-[var(--muted-foreground)]">{fetchError}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--muted)]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Select an Institution</h1>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
        Browse available institutions and request to join one. An admin will review your request.
      </p>

      {/* Filters */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
          placeholder="Filter by country..."
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] sm:max-w-xs"
        />
        <input
          type="text"
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          placeholder="Filter by state..."
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] sm:max-w-xs"
        />
      </div>

      {/* Empty state */}
      {filteredInstitutions.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] p-8 text-center">
          <p className="text-[var(--muted-foreground)]">
            {countryFilter || stateFilter
              ? "No institutions match your filters. Try adjusting your search."
              : "No institutions are available at this time."}
          </p>
        </div>
      ) : (
        /* Institution grid */
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredInstitutions.map((inst) => {
            const state = getCardState(inst.id);
            const existingStatus = existingMembershipStatus(inst.id);
            const isDisabled =
              state.status === "joining" ||
              state.status === "submitting_code" ||
              state.status === "success" ||
              existingStatus === "pending" ||
              existingStatus === "approved";

            return (
              <div
                key={inst.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 flex flex-col"
              >
                {/* Institution info */}
                <h3 className="font-semibold text-[var(--card-foreground)]">
                  {inst.name}
                </h3>

                {inst.branding?.tagline && (
                  <p className="mt-1 text-sm text-[var(--muted-foreground)] line-clamp-2">
                    {inst.branding.tagline}
                  </p>
                )}

                {inst.location && (inst.location.city || inst.location.state || inst.location.country) && (
                  <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                    {[inst.location.city, inst.location.state, inst.location.country]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                )}

                {/* Spacer to push actions to bottom */}
                <div className="flex-1" />

                {/* Success state */}
                {(state.status === "success" || existingStatus === "pending") && (
                  <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
                    Request submitted — awaiting admin approval
                  </div>
                )}

                {/* Already approved */}
                {existingStatus === "approved" && (
                  <div className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
                    You are already a member of this institution
                  </div>
                )}

                {/* Error */}
                {state.error && state.status !== "success" && (
                  <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                    {state.error}
                  </div>
                )}

                {/* Actions */}
                {!isDisabled && (
                  <div className="mt-4 space-y-3">
                    {/* Invite code input (shown when entering_code) */}
                    {state.status === "entering_code" && (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={state.inviteCode}
                          onChange={(e) =>
                            updateCardState(inst.id, { inviteCode: e.target.value })
                          }
                          placeholder="Enter invite code"
                          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleJoinWithCode(inst.id);
                            }
                          }}
                        />
                        <button
                          onClick={() => handleJoinWithCode(inst.id)}
                          className="rounded-lg px-3 py-2 text-sm font-medium text-white bg-[var(--brand-primary)]"
                        >
                          Submit
                        </button>
                        <button
                          onClick={() =>
                            updateCardState(inst.id, {
                              status: "idle",
                              inviteCode: "",
                              error: null,
                            })
                          }
                          className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    {/* Action buttons (shown in idle/error states, not when entering_code) */}
                    {state.status !== "entering_code" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleJoin(inst.id)}
                          disabled={state.status === "joining"}
                          className="flex-1 rounded-lg px-4 py-2 text-sm font-medium text-white bg-[var(--brand-primary)] disabled:opacity-50"
                        >
                          {state.status === "joining" ? "Requesting..." : "Join"}
                        </button>
                        <button
                          onClick={() =>
                            updateCardState(inst.id, {
                              status: "entering_code",
                              error: null,
                            })
                          }
                          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--muted)]"
                        >
                          Join with Code
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
