import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { updateLessonSchema } from "@shared/validators/course.validator";

/**
 * GET /api/courses/:id/modules/:moduleId/lessons/:lessonId
 * Get a single lesson.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; moduleId: string; lessonId: string }> }
) {
  try {
    const { id: courseId, moduleId, lessonId } = await params;
    const sessionCookie = request.cookies.get("__session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, false);
    const db = getAdminDb();

    const courseDoc = await db.collection("courses").doc(courseId).get();
    if (!courseDoc.exists) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const course = courseDoc.data()!;
    const role = decoded.role || "student";

    if (role !== "super_admin" && course.institutionId !== decoded.institutionId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const lessonRef = db
      .collection("courses")
      .doc(courseId)
      .collection("modules")
      .doc(moduleId)
      .collection("lessons")
      .doc(lessonId);

    const lessonDoc = await lessonRef.get();
    if (!lessonDoc.exists) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    const lessonData = lessonDoc.data()!;
    const lesson = { id: lessonDoc.id, ...lessonData };
    const isAdminOrInstructor = ["super_admin", "institution_admin", "instructor"].includes(role);

    if (!isAdminOrInstructor && !lessonData.isPublished) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    return NextResponse.json({ lesson });
  } catch (err) {
    console.error("GET lesson detail error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/courses/:id/modules/:moduleId/lessons/:lessonId
 * Update a lesson.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; moduleId: string; lessonId: string }> }
) {
  try {
    const { id: courseId, moduleId, lessonId } = await params;
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

    const body = await request.json();
    const parsed = updateLessonSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const lessonRef = db
      .collection("courses")
      .doc(courseId)
      .collection("modules")
      .doc(moduleId)
      .collection("lessons")
      .doc(lessonId);

    const lessonDoc = await lessonRef.get();
    if (!lessonDoc.exists) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    await lessonRef.update({
      ...parsed.data,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const updated = await lessonRef.get();
    return NextResponse.json({ lesson: { id: updated.id, ...updated.data() } });
  } catch (err) {
    console.error("PUT lesson error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/courses/:id/modules/:moduleId/lessons/:lessonId
 * Delete a lesson.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; moduleId: string; lessonId: string }> }
) {
  try {
    const { id: courseId, moduleId, lessonId } = await params;
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

    const lessonRef = db
      .collection("courses")
      .doc(courseId)
      .collection("modules")
      .doc(moduleId)
      .collection("lessons")
      .doc(lessonId);

    const lessonDoc = await lessonRef.get();
    if (!lessonDoc.exists) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    const moduleRef = db
      .collection("courses")
      .doc(courseId)
      .collection("modules")
      .doc(moduleId);

    // Batch: delete lesson + remove from module.lessonOrder
    const batch = db.batch();
    batch.delete(lessonRef);
    batch.update(moduleRef, {
      lessonOrder: FieldValue.arrayRemove(lessonId),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE lesson error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
