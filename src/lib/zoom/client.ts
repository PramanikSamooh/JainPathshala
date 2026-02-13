import "server-only";

import { getZoomAccessToken } from "./auth";
import type {
  ZoomCredentials,
  ZoomMeeting,
  ZoomRegistrant,
  ZoomParticipant,
  ZoomMeetingReport,
  CreateZoomMeetingParams,
} from "@shared/types/zoom";

const ZOOM_API_BASE = "https://api.zoom.us/v2";

// ─── Internal Helpers ────────────────────────────────────

async function zoomFetch(
  creds: ZoomCredentials,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getZoomAccessToken(
    creds.accountId,
    creds.clientId,
    creds.clientSecret
  );

  return fetch(`${ZOOM_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

async function zoomFetchJson<T>(
  creds: ZoomCredentials,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await zoomFetch(creds, path, options);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Zoom API error (${res.status}) ${path}: ${err}`);
  }
  return res.json();
}

// ─── Meetings ────────────────────────────────────────────

export async function createZoomMeeting(
  creds: ZoomCredentials,
  params: CreateZoomMeetingParams
): Promise<ZoomMeeting> {
  const body: Record<string, unknown> = {
    topic: params.topic,
    type: 2, // scheduled
    start_time: params.startTime,
    duration: params.duration,
    timezone: params.timezone,
    agenda: params.agenda || "",
    settings: {
      host_video: true,
      participant_video: true,
      join_before_host: false,
      mute_upon_entry: true,
      waiting_room: true,
      auto_recording: "none",
      ...params.settings,
    },
  };

  if (params.registrationRequired) {
    body.settings = {
      ...(body.settings as Record<string, unknown>),
      approval_type: 0, // auto-approve
      registration_type: 1, // register once
    };
  }

  return zoomFetchJson<ZoomMeeting>(
    creds,
    `/users/${creds.defaultUserId}/meetings`,
    { method: "POST", body: JSON.stringify(body) }
  );
}

export async function getZoomMeeting(
  creds: ZoomCredentials,
  meetingId: number
): Promise<ZoomMeeting> {
  return zoomFetchJson<ZoomMeeting>(creds, `/meetings/${meetingId}`);
}

export async function updateZoomMeeting(
  creds: ZoomCredentials,
  meetingId: number,
  updates: Partial<CreateZoomMeetingParams>
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (updates.topic) body.topic = updates.topic;
  if (updates.startTime) body.start_time = updates.startTime;
  if (updates.duration) body.duration = updates.duration;
  if (updates.timezone) body.timezone = updates.timezone;
  if (updates.agenda) body.agenda = updates.agenda;
  if (updates.settings) body.settings = updates.settings;

  const res = await zoomFetch(creds, `/meetings/${meetingId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Zoom updateMeeting failed (${res.status}): ${err}`);
  }
}

export async function deleteZoomMeeting(
  creds: ZoomCredentials,
  meetingId: number
): Promise<void> {
  const res = await zoomFetch(creds, `/meetings/${meetingId}`, {
    method: "DELETE",
  });

  if (!res.ok && res.status !== 204) {
    const err = await res.text();
    throw new Error(`Zoom deleteMeeting failed (${res.status}): ${err}`);
  }
}

// ─── Registration ────────────────────────────────────────

export async function addZoomRegistrant(
  creds: ZoomCredentials,
  meetingId: number,
  email: string,
  firstName: string,
  lastName: string
): Promise<ZoomRegistrant> {
  return zoomFetchJson<ZoomRegistrant>(
    creds,
    `/meetings/${meetingId}/registrants`,
    {
      method: "POST",
      body: JSON.stringify({ email, first_name: firstName, last_name: lastName }),
    }
  );
}

export async function listZoomRegistrants(
  creds: ZoomCredentials,
  meetingId: number,
  status: "approved" | "pending" | "denied" = "approved"
): Promise<ZoomRegistrant[]> {
  const registrants: ZoomRegistrant[] = [];
  let nextPageToken = "";

  do {
    const query = new URLSearchParams({
      status,
      page_size: "100",
      ...(nextPageToken ? { next_page_token: nextPageToken } : {}),
    });

    const data = await zoomFetchJson<{
      registrants: ZoomRegistrant[];
      next_page_token: string;
    }>(creds, `/meetings/${meetingId}/registrants?${query}`);

    registrants.push(...data.registrants);
    nextPageToken = data.next_page_token || "";
  } while (nextPageToken);

  return registrants;
}

// ─── Reports / Participants ──────────────────────────────

export async function getZoomMeetingReport(
  creds: ZoomCredentials,
  meetingId: number | string
): Promise<ZoomMeetingReport> {
  return zoomFetchJson<ZoomMeetingReport>(
    creds,
    `/report/meetings/${meetingId}`
  );
}

export async function getZoomPastMeetingParticipants(
  creds: ZoomCredentials,
  meetingUuid: string
): Promise<ZoomParticipant[]> {
  // Double-encode UUID if it starts with / or contains //
  const encodedUuid =
    meetingUuid.startsWith("/") || meetingUuid.includes("//")
      ? encodeURIComponent(encodeURIComponent(meetingUuid))
      : encodeURIComponent(meetingUuid);

  const participants: ZoomParticipant[] = [];
  let nextPageToken = "";

  do {
    const query = new URLSearchParams({
      page_size: "100",
      ...(nextPageToken ? { next_page_token: nextPageToken } : {}),
    });

    const data = await zoomFetchJson<{
      participants: ZoomParticipant[];
      next_page_token: string;
    }>(creds, `/past_meetings/${encodedUuid}/participants?${query}`);

    participants.push(...data.participants);
    nextPageToken = data.next_page_token || "";
  } while (nextPageToken);

  return participants;
}
