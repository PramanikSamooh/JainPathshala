import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import {
  verifyZoomWebhook,
  generateZoomCrcResponse,
} from "@/lib/zoom/webhook-verify";
import { FieldValue } from "firebase-admin/firestore";

/**
 * POST /api/webhooks/zoom
 * Zoom webhook handler — meeting lifecycle + participant tracking.
 * No session auth — verifies via x-zm-signature header.
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const event = JSON.parse(rawBody);

    const webhookSecret = process.env.ZOOM_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("ZOOM_WEBHOOK_SECRET not set");
      return NextResponse.json(
        { error: "Server misconfiguration" },
        { status: 500 }
      );
    }

    // Handle Zoom endpoint URL validation (CRC challenge)
    if (event.event === "endpoint.url_validation") {
      const plainToken = event.payload.plainToken;
      const encryptedToken = generateZoomCrcResponse(plainToken, webhookSecret);
      return NextResponse.json({ plainToken, encryptedToken });
    }

    // Verify webhook signature
    const signature = request.headers.get("x-zm-signature") || "";
    const timestamp = request.headers.get("x-zm-request-timestamp") || "";

    if (
      !verifyZoomWebhook({
        body: rawBody,
        signature,
        timestamp,
        secret: webhookSecret,
      })
    ) {
      console.warn("Invalid Zoom webhook signature");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const eventType = event.event as string;
    const meetingObj = event.payload?.object;
    const meetingId = meetingObj?.id;

    if (!meetingId) {
      return NextResponse.json({ status: "ignored" });
    }

    const meetingDocId = String(meetingId);

    switch (eventType) {
      case "meeting.started": {
        const meetingRef = db.collection("zoomMeetings").doc(meetingDocId);
        await meetingRef.set(
          {
            zoomMeetingId: meetingId,
            status: "started",
            actualStartTime: meetingObj.start_time || new Date().toISOString(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        break;
      }

      case "meeting.ended": {
        const meetingRef = db.collection("zoomMeetings").doc(meetingDocId);
        await meetingRef.set(
          {
            zoomMeetingId: meetingId,
            status: "ended",
            actualEndTime: new Date().toISOString(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        break;
      }

      case "meeting.participant_joined": {
        const participant = meetingObj.participant;
        if (!participant) break;

        const participantDocId =
          participant.user_id || participant.id || `anon-${Date.now()}`;
        const participantRef = db
          .collection("zoomMeetings")
          .doc(meetingDocId)
          .collection("participants")
          .doc(participantDocId);

        await participantRef.set(
          {
            participantId: participantDocId,
            zoomMeetingId: meetingId,
            userName: participant.user_name || participant.participant_user_name || "",
            email: participant.email || "",
            joinTime: participant.join_time || new Date().toISOString(),
            status: "in_meeting",
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        // Increment live participant count
        const meetingRef = db.collection("zoomMeetings").doc(meetingDocId);
        await meetingRef.set(
          {
            liveParticipantCount: FieldValue.increment(1),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        break;
      }

      case "meeting.participant_left": {
        const participant = meetingObj.participant;
        if (!participant) break;

        const participantDocId =
          participant.user_id || participant.id || `anon-${Date.now()}`;
        const participantRef = db
          .collection("zoomMeetings")
          .doc(meetingDocId)
          .collection("participants")
          .doc(participantDocId);

        await participantRef.set(
          {
            leaveTime: participant.leave_time || new Date().toISOString(),
            status: "left",
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        // Decrement live participant count
        const meetingRef = db.collection("zoomMeetings").doc(meetingDocId);
        await meetingRef.set(
          {
            liveParticipantCount: FieldValue.increment(-1),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        break;
      }

      default:
        console.warn(`Unhandled Zoom event: ${eventType}`);
    }

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("Zoom webhook processing failed:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
