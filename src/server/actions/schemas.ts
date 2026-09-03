import { z } from "zod";

import { InviteError, isAppError } from "@/server/errors";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string };

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address");

export const groupIdSchema = z.string().uuid();
export const invitationIdSchema = z.string().uuid();
export const tokenSchema = z.string().min(10);

export function toActionError(e: unknown): { code: string; message: string } {
  if (e instanceof InviteError)
    return { code: `invite:${e.inviteCode}`, message: e.message };
  if (isAppError(e)) return { code: e.code, message: e.message };
  return { code: "unknown", message: "Something went wrong" };
}
