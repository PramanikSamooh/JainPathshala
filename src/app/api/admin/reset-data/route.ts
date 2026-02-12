import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { writeAuditLog } from "@/lib/audit-log";

const BATCH_SIZE = 500;

async function deleteCollection(
  db: FirebaseFirestore.Firestore,
  collectionPath: string,
  institutionId: string,
  excludeDocId?: string
): Promise<number> {
  let deleted = 0;
  let query = db
    .collection(collectionPath)
    .where("institutionId", "==", institutionId)
    .limit(BATCH_SIZE);

  let snap = await query.get();
  while (!snap.empty) {
    const batch = db.batch();
    for (const doc of snap.docs) {
      if (excludeDocId && doc.id === excludeDocId) continue;
      batch.delete(doc.ref);
      deleted++;
    }
    await batch.commit();
    snap = await query.get();
  }
  return deleted;
}

async function deleteCourseSubcollections(
  db: FirebaseFirestore.Firestore,
  courseId: string
): Promise<void> {
  // Delete lessons inside each module
  const modulesSnap = await db
    .collection("courses")
    .doc(courseId)
    .collection("modules")
    .get();

  for (const moduleDoc of modulesSnap.docs) {
    const lessonsSnap = await db
      .collection("courses")
      .doc(courseId)
      .collection("modules")
      .doc(moduleDoc.id)
      .collection("lessons")
      .get();

    const batch = db.batch();
    for (const lessonDoc of lessonsSnap.docs) {
      batch.delete(lessonDoc.ref);
    }
    batch.delete(moduleDoc.ref);
    await batch.commit();
  }

  // Delete sessions subcollection
  const sessionsSnap = await db
    .collection("courses")
    .doc(courseId)
    .collection("sessions")
    .get();

  if (!sessionsSnap.empty) {
    const batch = db.batch();
    for (const doc of sessionsSnap.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
  }
}

async function deleteUsersWithAuth(
  db: FirebaseFirestore.Firestore,
  auth: ReturnType<typeof getAdminAuth>,
  institutionId: string,
  requestingUid: string
): Promise<number> {
  let deleted = 0;
  let query = db
    .collection("users")
    .where("institutionId", "==", institutionId)
    .limit(BATCH_SIZE);

  let snap = await query.get();
  while (!snap.empty) {
    const batch = db.batch();
    for (const doc of snap.docs) {
      if (doc.id === requestingUid) continue;
      batch.delete(doc.ref);
      deleted++;

      // Delete Firebase Auth user
      try {
        await auth.deleteUser(doc.id);
      } catch {
        // User may not exist in Auth — ignore
      }
    }
    await batch.commit();

    // Re-query (excluding already deleted)
    snap = await query.get();
  }
  return deleted;
}

/**
 * POST /api/admin/reset-data
 * Full data wipe for an institution. Super admin only.
 * Requires confirmPhrase: "DELETE ALL DATA"
 */
export async function POST(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get("__session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    if (decoded.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden — super admin only" }, { status: 403 });
    }

    const body = await request.json();
    if (body.confirmPhrase !== "DELETE ALL DATA") {
      return NextResponse.json(
        { error: "Invalid confirmation phrase" },
        { status: 400 }
      );
    }

    const institutionId = decoded.institutionId;
    if (!institutionId) {
      return NextResponse.json({ error: "No institution assigned" }, { status: 400 });
    }

    const db = getAdminDb();
    const auth = getAdminAuth();
    const counts: Record<string, number> = {};

    // 1. Delete courses + subcollections
    const coursesSnap = await db
      .collection("courses")
      .where("institutionId", "==", institutionId)
      .get();

    for (const courseDoc of coursesSnap.docs) {
      await deleteCourseSubcollections(db, courseDoc.id);
    }
    // Now delete course docs
    const courseBatch = db.batch();
    for (const courseDoc of coursesSnap.docs) {
      courseBatch.delete(courseDoc.ref);
    }
    await courseBatch.commit();
    counts.courses = coursesSnap.size;

    // 2. Delete users (except requesting admin) + their Firebase Auth accounts
    counts.users = await deleteUsersWithAuth(db, auth, institutionId, decoded.uid);

    // 3. Delete other collections
    const collections = [
      "enrollments",
      "payments",
      "attendance",
      "certificates",
      "exams",
      "examAttempts",
      "videoProgress",
      "auditLogs",
    ];

    for (const col of collections) {
      counts[col] = await deleteCollection(db, col, institutionId);
    }

    writeAuditLog({
      institutionId,
      userId: decoded.uid,
      userEmail: decoded.email || "",
      userRole: decoded.role,
      action: "admin.reset_data",
      resource: "institution",
      resourceId: institutionId,
      details: { counts },
      severity: "critical",
    }, request);

    return NextResponse.json({
      message: "Data reset complete",
      counts,
      preserved: {
        institution: institutionId,
        adminUser: decoded.uid,
      },
    });
  } catch (err) {
    console.error("Reset data failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
