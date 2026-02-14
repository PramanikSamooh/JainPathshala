import { z } from "zod/v4";

export const requestMembershipSchema = z.object({
  institutionId: z.string().min(1),
  joinMethod: z.enum(["browse", "invite_code"]).default("browse"),
  inviteCode: z.string().min(1).optional(),
});

export const reviewMembershipSchema = z.object({
  userId: z.string().min(1),
  action: z.enum(["approve", "reject", "transfer"]),
  note: z.string().max(500).optional(),
  transferToInstitutionId: z.string().min(1).optional(),
});

export const userAddressSchema = z.object({
  city: z.string().min(2).max(100),
  state: z.string().min(2).max(100),
  country: z.string().min(2).max(100),
  pincode: z.string().min(4).max(10),
});

export type RequestMembershipInput = z.infer<typeof requestMembershipSchema>;
export type ReviewMembershipInput = z.infer<typeof reviewMembershipSchema>;
export type UserAddressInput = z.infer<typeof userAddressSchema>;
