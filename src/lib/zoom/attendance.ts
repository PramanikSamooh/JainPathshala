import "server-only";

import { getZoomPastMeetingParticipants } from "./client";
import type { ZoomCredentials } from "@shared/types/zoom";

interface EnrolledStudent {
  userId: string;
  email: string;
}

interface AttendanceResult {
  userId: string;
  email: string;
  status: "present" | "late" | "absent";
  joinedAt: string | null;
  leftAt: string | null;
  durationMinutes: number;
}

/**
 * Get Zoom meeting attendance matched to enrolled students.
 * Mirrors the logic in src/lib/google/meet.ts getMeetAttendance().
 *
 * Thresholds:
 * - ≥50% of session duration attended → "present" (or "late" if joined >10min after start)
 * - <50% attended → "late"
 * - Not found → "absent"
 */
export async function getZoomAttendance(
  creds: ZoomCredentials,
  meetingUuid: string,
  sessionStartTime: string,
  sessionEndTime: string,
  enrolledStudents: EnrolledStudent[]
): Promise<AttendanceResult[]> {
  const result: AttendanceResult[] = enrolledStudents.map((student) => ({
    userId: student.userId,
    email: student.email,
    status: "absent" as const,
    joinedAt: null,
    leftAt: null,
    durationMinutes: 0,
  }));

  try {
    const participants = await getZoomPastMeetingParticipants(
      creds,
      meetingUuid
    );

    const sessionStart = new Date(sessionStartTime).getTime();
    const sessionEnd = new Date(sessionEndTime).getTime();
    const sessionDurationMs = sessionEnd - sessionStart;
    const lateThresholdMs = 10 * 60 * 1000; // 10 minutes

    // Aggregate participant durations by email (a user may join/leave multiple times)
    const emailDurations = new Map<
      string,
      { totalSeconds: number; firstJoin: string; lastLeave: string }
    >();

    for (const p of participants) {
      const email = p.user_email?.toLowerCase();
      if (!email) continue;

      const existing = emailDurations.get(email);
      if (existing) {
        existing.totalSeconds += p.duration;
        if (p.join_time < existing.firstJoin) existing.firstJoin = p.join_time;
        if (p.leave_time > existing.lastLeave)
          existing.lastLeave = p.leave_time;
      } else {
        emailDurations.set(email, {
          totalSeconds: p.duration,
          firstJoin: p.join_time,
          lastLeave: p.leave_time,
        });
      }
    }

    for (let i = 0; i < result.length; i++) {
      const entry = emailDurations.get(result[i].email.toLowerCase());
      if (!entry) continue;

      const attendedMs = entry.totalSeconds * 1000;
      const attendedPercent = attendedMs / sessionDurationMs;
      const joinTime = new Date(entry.firstJoin).getTime();
      const joinedLate = joinTime - sessionStart > lateThresholdMs;

      let status: "present" | "late" | "absent";
      if (attendedPercent >= 0.5) {
        status = joinedLate ? "late" : "present";
      } else if (entry.totalSeconds > 0) {
        status = "late";
      } else {
        status = "absent";
      }

      result[i] = {
        ...result[i],
        status,
        joinedAt: entry.firstJoin,
        leftAt: entry.lastLeave,
        durationMinutes: Math.round(entry.totalSeconds / 60),
      };
    }
  } catch (err) {
    console.error("Failed to get Zoom meeting participants:", err);
  }

  return result;
}
