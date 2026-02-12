import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { getMeetAttendance } from "@/lib/google/meet";

/**
 * POST /api/courses/:id/sessions/:sessionId/sync-attendance
 * Sync attendance from Google Meet participation data.
 * Instructor triggers this after a session ends.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  try {
    const { id: courseId, sessionId } = await params;
    const sessionCookie = request.cookies.get("__session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    const role = decoded.role || "student";
    const allowedRoles = ["super_admin", "institution_admin", "instructor"];
    if (!allowedRoles.includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = getAdminDb();
    const courseDoc = await db.collection("courses").doc(courseId).get();
    if (!courseDoc.exists) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const course = courseDoc.data()!;
    if (role !== "super_admin" && course.institutionId !== decoded.institutionId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (role === "instructor" && !course.instructorIds?.includes(decoded.uid)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get session document
    const sessionRef = db
      .collection("courses")
      .doc(courseId)
      .collection("sessions")
      .doc(sessionId);
    const sessionDoc = await sessionRef.get();

    if (!sessionDoc.exists) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const sessionData = sessionDoc.data()!;

    if (!sessionData.meetLink) {
      return NextResponse.json(
        { error: "No Meet link associated with this session" },
        { status: 400 }
      );
    }

    // Get institution for Google credentials
    const instDoc = await db.collection("institutions").doc(course.institutionId).get();
    if (!instDoc.exists) {
      return NextResponse.json({ error: "Institution not found" }, { status: 404 });
    }

    const institution = instDoc.data()!;
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    const adminEmail = institution.googleWorkspace?.adminEmail;

    if (!serviceAccountKey || !adminEmail) {
      return NextResponse.json(
        { error: "Google credentials not configured" },
        { status: 500 }
      );
    }

    // Get enrolled students with their emails
    const enrollmentsSnap = await db
      .collection("enrollments")
      .where("courseId", "==", courseId)
      .where("status", "==", "active")
      .get();

    const enrolledEmails: { userId: string; email: string }[] = [];
    for (const enrollDoc of enrollmentsSnap.docs) {
      const enroll = enrollDoc.data();
      const userDoc = await db.collection("users").doc(enroll.userId).get();
      if (userDoc.exists) {
        enrolledEmails.push({
          userId: enroll.userId,
          email: userDoc.data()!.email,
        });
      }
    }

    // Build session time strings
    const sessionStartTime = `${sessionData.sessionDate}T${sessionData.startTime}:00+05:30`;
    const sessionEndTime = `${sessionData.sessionDate}T${sessionData.endTime}:00+05:30`;

    // Get attendance from Meet API
    const attendance = await getMeetAttendance(
      serviceAccountKey,
      adminEmail,
      sessionData.meetLink,
      sessionStartTime,
      sessionEndTime,
      enrolledEmails
    );

    // Save attendance records
    const batch = db.batch();
    const results: { userId: string; status: string; durationMinutes: number }[] = [];

    for (const record of attendance) {
      const docId = `${courseId}_${sessionData.sessionDate}_${record.userId}`;
      const ref = db.collection("attendance").doc(docId);

      batch.set(
        ref,
        {
          id: docId,
          courseId,
          userId: record.userId,
          institutionId: course.institutionId,
          sessionDate: sessionData.sessionDate,
          sessionId,
          status: record.status,
          joinedAt: record.joinedAt,
          leftAt: record.leftAt,
          durationMinutes: record.durationMinutes,
          syncedFromMeet: true,
          markedBy: decoded.uid,
          markedAt: FieldValue.serverTimestamp(),
          notes: null,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      results.push({
        userId: record.userId,
        status: record.status,
        durationMinutes: record.durationMinutes,
      });
    }

    await batch.commit();

    // Update enrollment attendance counts
    for (const record of attendance) {
      const presentSnap = await db
        .collection("attendance")
        .where("courseId", "==", courseId)
        .where("userId", "==", record.userId)
        .where("status", "in", ["present", "late"])
        .get();

      const totalSnap = await db
        .collection("attendance")
        .where("courseId", "==", courseId)
        .where("userId", "==", record.userId)
        .get();

      const enrollSnap = await db
        .collection("enrollments")
        .where("courseId", "==", courseId)
        .where("userId", "==", record.userId)
        .where("status", "==", "active")
        .limit(1)
        .get();

      if (!enrollSnap.empty) {
        await enrollSnap.docs[0].ref.update({
          attendanceCount: presentSnap.size,
          totalSessions: totalSnap.size,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }

    return NextResponse.json({
      message: `Synced ${results.length} attendance records from Meet`,
      results,
      summary: {
        present: results.filter((r) => r.status === "present").length,
        late: results.filter((r) => r.status === "late").length,
        absent: results.filter((r) => r.status === "absent").length,
      },
    });
  } catch (err) {
    console.error("POST sync-attendance error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
