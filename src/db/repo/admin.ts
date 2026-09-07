import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { adminActions } from "@/db/schema";

export async function logAdminAction(params: {
  adminTelegramId: number;
  action: string;
  targetUserId?: number;
  details?: Record<string, unknown>;
}) {
  await db.insert(adminActions).values({
    id: randomUUID(),
    adminTelegramId: params.adminTelegramId,
    action: params.action,
    targetUserId: params.targetUserId,
    details: params.details ?? {},
  });
}
