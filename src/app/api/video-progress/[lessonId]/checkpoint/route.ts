import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { recordCheckpointResponseSchema } from "@shared/validators/enrollment.validator";

/**
 * POST /api/video-progress/:lessonId/checkpoint
 * Record a checkpoint response for the authenticated user + lesson.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    const { lessonId } = await params;
    const sessionCookie = request.cookies.get("__session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    const body = await request.json();
    const parsed = recordCheckpointResponseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { checkpointId, selectedOptionId, textAnswer } = parsed.data;
    const db = getAdminDb();
    const docId = `${decoded.uid}_${lessonId}`;
    const docRef = db.collection("videoProgress").doc(docId);
    const existing = await docRef.get();

    const responseData = {
      answeredAt: FieldValue.serverTimestamp(),
      selectedOptionId: selectedOptionId || null,
      textAnswer: textAnswer || null,
      isCorrect: body.isCorrect ?? false,
    };

    if (existing.exists) {
      await docRef.update({
        [`checkpointResponses.${checkpointId}`]: responseData,
        lastUpdatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      // Create skeleton doc
      const institutionId = decoded.institutionId ||
        (await db.collection("users").doc(decoded.uid).get()).data()?.institutionId ||
        process.env.NEXT_PUBLIC_DEFAULT_INSTITUTION_ID || "ifs";

      await docRef.set({
        id: docId,
        userId: decoded.uid,
        courseId: body.courseId || "",
        moduleId: body.moduleId || "",
        lessonId,
        institutionId,
        currentPositionSeconds: 0,
        totalDurationSeconds: 0,
        watchedSeconds: 0,
        watchedPercentage: 0,
        isCompleted: false,
        checkpointResponses: { [checkpointId]: responseData },
        watchedSegments: [],
        createdAt: FieldValue.serverTimestamp(),
        lastUpdatedAt: FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/video-progress/checkpoint error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
