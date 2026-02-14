import type { Timestamp } from "firebase/firestore";
import type { UserRole } from "../enums/roles";
import type { MembershipStatus } from "../enums/membership-status";

export type JoinMethod = "browse" | "invite_code" | "email_domain" | "admin_added";

/**
 * Stored at: users/{uid}/memberships/{institutionId}
 * Represents a user's membership in an institution.
 */
export interface InstitutionMembership {
  id: string; // same as institutionId
  userId: string;
  institutionId: string;
  role: UserRole;
  status: MembershipStatus;
  isExternal: boolean;
  joinMethod: JoinMethod;
  requestedAt: Timestamp;
  reviewedAt: Timestamp | null;
  reviewedBy: string | null; // admin uid who approved/rejected
  reviewNote: string | null; // admin's note (e.g., transfer reason)
  transferredTo: string | null; // institutionId if transferred
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
