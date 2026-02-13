/**
 * Minimal Zoom API client for Cloud Functions.
 *
 * Separate from src/lib/zoom/ because Cloud Functions have their own
 * package.json and tsconfig — same pattern as google-clients.ts.
 */

interface ZoomTokenCache {
  accessToken: string;
  expiresAt: number;
}

const tokenCache = new Map<string, ZoomTokenCache>();

interface ZoomCredentials {
  accountId: string;
  clientId: string;
  clientSecret: string;
  defaultUserId: string;
}

async function getZoomToken(
  accountId: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const cached = tokenCache.get(accountId);
  const now = Date.now();

  if (cached && cached.expiresAt - now > 5 * 60 * 1000) {
    return cached.accessToken;
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64"
  );

  const response = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "account_credentials",
      account_id: accountId,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Zoom OAuth failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const token: ZoomTokenCache = {
    accessToken: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };

  tokenCache.set(accountId, token);
  return token.accessToken;
}

/**
 * Register a user for a Zoom meeting.
 */
export async function registerZoomParticipant(
  creds: ZoomCredentials,
  meetingId: number,
  email: string,
  firstName: string,
  lastName: string
): Promise<{ join_url: string; registrant_id: string }> {
  const token = await getZoomToken(
    creds.accountId,
    creds.clientId,
    creds.clientSecret
  );

  const response = await fetch(
    `https://api.zoom.us/v2/meetings/${meetingId}/registrants`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        first_name: firstName,
        last_name: lastName,
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(
      `Zoom registration failed (${response.status}): ${err}`
    );
  }

  return response.json();
}

/**
 * Resolve Zoom credentials from institution config or env vars.
 */
export function getZoomCredentials(
  zoomConfig?: {
    accountId: string;
    clientId: string;
    clientSecretRef: string;
    defaultUserId: string;
    isEnabled?: boolean;
  } | null
): ZoomCredentials | null {
  if (zoomConfig?.accountId && zoomConfig.isEnabled !== false) {
    return {
      accountId: zoomConfig.accountId,
      clientId: zoomConfig.clientId,
      clientSecret: zoomConfig.clientSecretRef,
      defaultUserId: zoomConfig.defaultUserId,
    };
  }

  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;

  if (!accountId || !clientId || !clientSecret) {
    return null;
  }

  return {
    accountId,
    clientId,
    clientSecret,
    defaultUserId: process.env.ZOOM_DEFAULT_USER_ID || "me",
  };
}
