import "server-only";

import { createHmac } from "crypto";

/**
 * Verify Zoom webhook signature.
 * Compares the x-zm-signature header against the HMAC-SHA256 of the message.
 */
export function verifyZoomWebhook(params: {
  body: string;
  signature: string;
  timestamp: string;
  secret: string;
}): boolean {
  const message = `v0:${params.timestamp}:${params.body}`;
  const hash = createHmac("sha256", params.secret)
    .update(message)
    .digest("hex");
  const expectedSignature = `v0=${hash}`;
  return expectedSignature === params.signature;
}

/**
 * Generate CRC response for Zoom endpoint URL validation.
 * Zoom sends a plainToken challenge that must be hashed and returned.
 */
export function generateZoomCrcResponse(
  plainToken: string,
  secret: string
): string {
  return createHmac("sha256", secret).update(plainToken).digest("hex");
}
