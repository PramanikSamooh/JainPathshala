import "server-only";

import type { ZoomCredentials, InstitutionZoom } from "@shared/types/zoom";

/**
 * Resolve Zoom credentials for an institution.
 * Priority: institution-level config > environment variables.
 */
export function getZoomCredentials(
  institutionZoomConfig?: InstitutionZoom | null
): ZoomCredentials {
  if (institutionZoomConfig?.accountId) {
    return {
      accountId: institutionZoomConfig.accountId,
      clientId: institutionZoomConfig.clientId,
      clientSecret: institutionZoomConfig.clientSecretRef,
      defaultUserId: institutionZoomConfig.defaultUserId,
    };
  }

  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;
  const defaultUserId = process.env.ZOOM_DEFAULT_USER_ID || "me";

  if (!accountId || !clientId || !clientSecret) {
    throw new Error(
      "Missing Zoom credentials. Set ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET env vars."
    );
  }

  return { accountId, clientId, clientSecret, defaultUserId };
}
