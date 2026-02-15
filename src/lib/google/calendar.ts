import "server-only";

import { google } from "googleapis";
import { getGoogleAuthClient } from "./auth-client";

export function getCalendarClient(adminEmail: string) {
  const auth = getGoogleAuthClient(adminEmail, [
    "https://www.googleapis.com/auth/calendar.events",
  ]);
  return google.calendar({ version: "v3", auth });
}

/**
 * Create a Calendar event with an auto-generated Google Meet link.
 */
export async function createMeetSession(
  adminEmail: string,
  params: {
    summary: string;
    description: string;
    startTime: string; // ISO 8601
    endTime: string;
    timeZone: string;
    attendeeEmails: string[];
    coHostEmails?: string[]; // Instructors who can manage participants
    requestId: string; // Unique ID for idempotency
  }
) {
  const calendar = getCalendarClient(adminEmail);

  // Build attendee list: co-hosts (instructors) first, then students
  const attendees = [
    ...(params.coHostEmails || []).map((email) => ({ email })),
    ...params.attendeeEmails.map((email) => ({ email })),
  ];

  const event = await calendar.events.insert({
    calendarId: adminEmail,
    conferenceDataVersion: 1,
    sendUpdates: "all",
    requestBody: {
      summary: params.summary,
      description: params.description,
      start: {
        dateTime: params.startTime,
        timeZone: params.timeZone,
      },
      end: {
        dateTime: params.endTime,
        timeZone: params.timeZone,
      },
      attendees,
      guestsCanModify: true,
      conferenceData: {
        createRequest: {
          requestId: params.requestId,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    },
  });

  const meetLink = event.data.conferenceData?.entryPoints?.find(
    (ep) => ep.entryPointType === "video"
  )?.uri;

  return {
    eventId: event.data.id!,
    meetLink: meetLink || null,
    htmlLink: event.data.htmlLink || null,
  };
}

/**
 * Delete a Calendar event by ID.
 */
export async function deleteCalendarEvent(
  adminEmail: string,
  calendarEventId: string
) {
  const calendar = getCalendarClient(adminEmail);
  await calendar.events.delete({
    calendarId: adminEmail,
    eventId: calendarEventId,
  });
}
