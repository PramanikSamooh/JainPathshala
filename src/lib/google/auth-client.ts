import "server-only";

import { google, type Auth } from "googleapis";

/**
 * Returns Google service account credentials from environment variables.
 * Uses GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.
 */
export function getServiceAccountCredentials(): {
  client_email: string;
  private_key: string;
} | null {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !privateKey) return null;
  // Vercel stores \n as literal characters — convert to actual newlines
  return { client_email: email, private_key: privateKey.replace(/\\n/g, "\n") };
}

/**
 * Creates a Google Auth client using service account with domain-wide delegation.
 * Used server-side only (API routes and Cloud Functions).
 */
export function getGoogleAuthClient(
  adminEmail: string,
  scopes: string[]
): Auth.GoogleAuth {
  const credentials = getServiceAccountCredentials();
  if (!credentials) {
    throw new Error(
      "Google service account not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY."
    );
  }
  return new google.auth.GoogleAuth({
    credentials,
    scopes,
    clientOptions: {
      subject: adminEmail,
    },
  });
}
