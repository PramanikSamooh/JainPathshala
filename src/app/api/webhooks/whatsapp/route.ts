import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/webhooks/whatsapp
 * WhatsApp webhook verification (required during setup).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/**
 * POST /api/webhooks/whatsapp
 * Receive incoming WhatsApp messages and status updates.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // WhatsApp sends status updates and messages
    const entries = body.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        if (change.field !== "messages") continue;

        const value = change.value;
        const messages = value.messages || [];
        const statuses = value.statuses || [];

        // Handle incoming messages (e.g., student replies)
        for (const msg of messages) {
          const from = msg.from; // phone number
          const text = msg.text?.body || "";
          const timestamp = msg.timestamp;

          // For now, log incoming messages
          // Future: implement chatbot responses, support ticketing
          console.warn(`WhatsApp message from ${from}: ${text} (${timestamp})`);
        }

        // Handle delivery/read status updates
        for (const status of statuses) {
          // status.status can be: sent, delivered, read, failed
          if (status.status === "failed") {
            console.error(`WhatsApp delivery failed to ${status.recipient_id}:`, status.errors);
          }
        }
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("WhatsApp webhook error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
