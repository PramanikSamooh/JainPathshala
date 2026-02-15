import { google, type Auth } from "googleapis";

/**
 * Returns Google service account credentials from environment variables.
 * Supports both separate vars (GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY)
 * and legacy JSON blob (GOOGLE_SERVICE_ACCOUNT_KEY).
 */
function getServiceAccountCredentials(): { client_email: string; private_key: string } {
  // Prefer separate env vars
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (email && privateKey) {
    return { client_email: email, private_key: privateKey };
  }

  // Fallback to legacy JSON blob
  const jsonKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (jsonKey) {
    return JSON.parse(jsonKey);
  }

  throw new Error(
    "Google service account not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY or GOOGLE_SERVICE_ACCOUNT_KEY."
  );
}

/**
 * Creates a Google Auth client using a service account with domain-wide delegation.
 * The service account impersonates the institution's admin user for API access.
 */
export function getAuthClient(
  adminEmail: string,
  scopes: string[]
): Auth.GoogleAuth {
  const credentials = getServiceAccountCredentials();
  return new google.auth.GoogleAuth({
    credentials,
    scopes,
    clientOptions: {
      subject: adminEmail,
    },
  });
}

export function getClassroomClient(adminEmail: string) {
  const auth = getAuthClient(adminEmail, [
    "https://www.googleapis.com/auth/classroom.courses",
    "https://www.googleapis.com/auth/classroom.rosters",
  ]);
  return google.classroom({ version: "v1", auth });
}

export function getCalendarClient(adminEmail: string) {
  const auth = getAuthClient(adminEmail, [
    "https://www.googleapis.com/auth/calendar.events",
  ]);
  return google.calendar({ version: "v3", auth });
}

export function getDriveClient(adminEmail: string) {
  const auth = getAuthClient(adminEmail, [
    "https://www.googleapis.com/auth/drive.file",
  ]);
  return google.drive({ version: "v3", auth });
}

export function getDocsClient(adminEmail: string) {
  const auth = getAuthClient(adminEmail, [
    "https://www.googleapis.com/auth/documents",
  ]);
  return google.docs({ version: "v1", auth });
}

export function getAdminSDKClient(adminEmail: string) {
  const auth = getAuthClient(adminEmail, [
    "https://www.googleapis.com/auth/admin.directory.user.readonly",
  ]);
  return google.admin({ version: "directory_v1", auth });
}
