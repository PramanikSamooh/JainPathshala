import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import type { NextRequest } from "next/server";

type AuditSeverity = "info" | "warning" | "critical";

interface AuditParams {
  institutionId: string;
  userId: string;
  userEmail: string;
  userRole: string;
  action: string;
  resource: string;
  resourceId: string;
  details?: Record<string, unknown>;
  severity?: AuditSeverity;
}

/**
 * Write an audit log entry from a Next.js API route.
 * Fire-and-forget — does not throw on failure so it doesn't break the request.
 */
export function writeAuditLog(params: AuditParams, request?: NextRequest) {
  const db = getAdminDb();
  db.collection("auditLogs")
    .add({
      ...params,
      details: params.details ?? {},
      previousValue: null,
      newValue: null,
      severity: params.severity ?? "info",
      ipAddress: request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      userAgent: request?.headers.get("user-agent") || null,
      createdAt: FieldValue.serverTimestamp(),
    })
    .catch((err) => {
      console.error("Failed to write audit log:", err);
    });
}
