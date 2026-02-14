import type { Timestamp } from "firebase/firestore";

// ─── Institution Zoom Config ─────────────────────────────

export interface InstitutionZoom {
  accountId: string;
  clientId: string;
  clientSecretRef: string;
  webhookSecretToken: string;
  defaultUserId: string; // Zoom user email or "me" for S2S OAuth
  isEnabled: boolean;
}

// ─── Zoom Meeting (API Response Shape) ───────────────────

export type ZoomMeetingType = 1 | 2 | 3 | 8; // instant, scheduled, recurring, recurring-fixed

export interface ZoomMeetingSettings {
  host_video: boolean;
  participant_video: boolean;
  join_before_host: boolean;
  mute_upon_entry: boolean;
  waiting_room: boolean;
  registration_type: 0 | 1 | 2; // 0=none, 1=register-once, 2=register-each
  approval_type: 0 | 1 | 2; // 0=auto, 1=manual, 2=no-registration
  auto_recording: "local" | "cloud" | "none";
  alternative_hosts: string; // Comma-separated emails of alternative hosts
}

export interface ZoomMeeting {
  id: number;
  uuid: string;
  topic: string;
  type: ZoomMeetingType;
  start_time: string;
  duration: number; // minutes
  timezone: string;
  join_url: string;
  start_url: string;
  password: string;
  settings: ZoomMeetingSettings;
  status: string;
  created_at: string;
}

// ─── Zoom Registrant ─────────────────────────────────────

export interface ZoomRegistrant {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  status: "approved" | "pending" | "denied";
  join_url: string;
  create_time: string;
}

// ─── Zoom Participant (Report) ───────────────────────────

export interface ZoomParticipant {
  id: string;
  user_id: string;
  name: string;
  user_email: string;
  join_time: string;
  leave_time: string;
  duration: number; // seconds
  registrant_id: string;
  status: "in_meeting" | "in_waiting_room";
}

// ─── Zoom Meeting Report ─────────────────────────────────

export interface ZoomMeetingReport {
  id: number;
  uuid: string;
  topic: string;
  start_time: string;
  end_time: string;
  duration: number;
  total_minutes: number;
  participants_count: number;
  participants: ZoomParticipant[];
}

// ─── Firestore Document: Zoom Meeting Record ─────────────

export interface ZoomMeetingRecord {
  id: string;
  zoomMeetingId: number;
  zoomMeetingUuid: string;
  institutionId: string;
  courseId: string | null;
  sessionId: string | null;
  topic: string;
  startTime: string;
  endTime: string;
  duration: number;
  timezone: string;
  joinUrl: string;
  startUrl: string;
  password: string;
  registrationRequired: boolean;
  status: "scheduled" | "started" | "ended" | "cancelled";
  hostEmail: string;
  participantCount: number;
  registrantCount: number;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Zoom Webhook ────────────────────────────────────────

export type ZoomWebhookEventType =
  | "meeting.started"
  | "meeting.ended"
  | "meeting.participant_joined"
  | "meeting.participant_left"
  | "meeting.registration_created"
  | "meeting.registration_approved"
  | "endpoint.url_validation";

export interface ZoomWebhookPayload {
  event: ZoomWebhookEventType;
  event_ts: number;
  payload: {
    account_id: string;
    object: Record<string, unknown>;
  };
}

// ─── Create Meeting Input ────────────────────────────────

export interface CreateZoomMeetingParams {
  topic: string;
  startTime: string; // ISO 8601
  duration: number; // minutes
  timezone: string;
  agenda?: string;
  registrationRequired: boolean;
  settings?: Partial<ZoomMeetingSettings>;
}

// ─── Zoom Credentials (runtime) ──────────────────────────

export interface ZoomCredentials {
  accountId: string;
  clientId: string;
  clientSecret: string;
  defaultUserId: string;
}
