import "server-only";

interface ZoomTokenCache {
  accessToken: string;
  expiresAt: number;
}

const tokenCache = new Map<string, ZoomTokenCache>();

/**
 * Get a valid Zoom Server-to-Server OAuth access token.
 * Tokens are cached per accountId until 5 minutes before expiry.
 */
export async function getZoomAccessToken(
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
