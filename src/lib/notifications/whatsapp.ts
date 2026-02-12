import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";

interface WhatsAppMessageParams {
  to: string;
  templateName: string;
  parameters: string[];
  institutionId: string;
}

interface WhatsAppTextParams {
  to: string;
  text: string;
  institutionId: string;
}

/**
 * Get WhatsApp Cloud API credentials for an institution.
 * Falls back to global env vars if institution-specific config not found.
 */
async function getWhatsAppConfig(institutionId: string) {
  const db = getAdminDb();

  if (institutionId) {
    const doc = await db.collection("institutions").doc(institutionId).get();
    if (doc.exists) {
      const data = doc.data();
      if (data?.whatsapp?.accessToken && data?.whatsapp?.phoneNumberId) {
        return {
          accessToken: data.whatsapp.accessToken,
          phoneNumberId: data.whatsapp.phoneNumberId,
          businessAccountId: data.whatsapp.businessAccountId || "",
        };
      }
    }
  }

  // Fallback to env vars
  return {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "",
  };
}

/**
 * Normalize phone number to WhatsApp format (no +, no leading 0).
 * E.g., "+91 98765 43210" → "919876543210"
 */
function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, "").replace(/^0+/, "");
}

/**
 * Send a WhatsApp template message via the Cloud API.
 *
 * Templates must be pre-approved in the WhatsApp Business Manager.
 * Common templates for an LMS:
 *   - session_reminder: "Hi {{1}}, your class {{2}} starts in 30 minutes."
 *   - assignment_due: "Hi {{1}}, your assignment {{2}} is due on {{3}}."
 *   - enrollment_confirmed: "Hi {{1}}, you are enrolled in {{2}}."
 *   - payment_receipt: "Hi {{1}}, payment of ₹{{2}} received for {{3}}."
 *   - certificate_issued: "Hi {{1}}, your certificate for {{2}} is ready."
 *   - general_notification: "{{1}}: {{2}}"
 */
export async function sendWhatsAppMessage(params: WhatsAppMessageParams): Promise<{ messageId: string }> {
  const config = await getWhatsAppConfig(params.institutionId);

  if (!config.accessToken || !config.phoneNumberId) {
    throw new Error("WhatsApp Cloud API not configured");
  }

  const phone = normalizePhone(params.to);

  const response = await fetch(
    `https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "template",
        template: {
          name: params.templateName,
          language: { code: "en" },
          components: [
            {
              type: "body",
              parameters: params.parameters.map((text) => ({
                type: "text",
                text,
              })),
            },
          ],
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`WhatsApp API error (${response.status}): ${JSON.stringify(err)}`);
  }

  const data = await response.json();
  return { messageId: data.messages?.[0]?.id || "" };
}

/**
 * Send a free-form text message (only allowed within 24h of user-initiated conversation).
 */
export async function sendWhatsAppText(params: WhatsAppTextParams): Promise<{ messageId: string }> {
  const config = await getWhatsAppConfig(params.institutionId);

  if (!config.accessToken || !config.phoneNumberId) {
    throw new Error("WhatsApp Cloud API not configured");
  }

  const phone = normalizePhone(params.to);

  const response = await fetch(
    `https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "text",
        text: { body: params.text },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`WhatsApp API error (${response.status}): ${JSON.stringify(err)}`);
  }

  const data = await response.json();
  return { messageId: data.messages?.[0]?.id || "" };
}
