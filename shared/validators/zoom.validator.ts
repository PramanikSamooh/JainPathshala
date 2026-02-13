import { z } from "zod/v4";

export const createZoomMeetingSchema = z.object({
  topic: z.string().min(1).max(200),
  startTime: z.string(), // ISO 8601
  duration: z.number().int().min(15).max(1440),
  timezone: z.string().default("Asia/Kolkata"),
  agenda: z.string().max(2000).optional(),
  registrationRequired: z.boolean().default(true),
  courseId: z.string().optional(),
  sessionId: z.string().optional(),
});

export const addZoomRegistrantSchema = z.object({
  email: z.email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

export const institutionZoomConfigSchema = z.object({
  accountId: z.string().min(1),
  clientId: z.string().min(1),
  clientSecretRef: z.string().min(1),
  webhookSecretToken: z.string().min(1),
  defaultUserId: z.string().min(1),
  isEnabled: z.boolean(),
});

export type CreateZoomMeetingInput = z.infer<typeof createZoomMeetingSchema>;
export type AddZoomRegistrantInput = z.infer<typeof addZoomRegistrantSchema>;
