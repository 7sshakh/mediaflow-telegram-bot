import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { tasks } from "@/db/schema";

export type TaskStatus =
  | "QUEUED"
  | "DOWNLOADING"
  | "PROCESSING"
  | "UPLOADING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type DbTask = typeof tasks.$inferSelect;

export async function createTask(params: {
  userId: string;
  type: string;
  url?: string;
  platform?: string;
}): Promise<DbTask> {
  const [row] = await db
    .insert(tasks)
    .values({
      id: randomUUID(),
      userId: params.userId,
      type: params.type,
      url: params.url,
      platform: params.platform,
      status: "QUEUED",
    })
    .returning();
  return row;
}

export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
  patch: Partial<{ progress: number; error: string | null }> = {},
) {
  const timeFields: Record<string, Date> = {};
  if (status === "DOWNLOADING") timeFields.startedAt = new Date();
  if (["COMPLETED", "FAILED", "CANCELLED"].includes(status)) timeFields.completedAt = new Date();

  await db
    .update(tasks)
    .set({ status, ...patch, ...timeFields })
    .where(eq(tasks.id, taskId));
}

export async function getTask(taskId: string): Promise<DbTask | undefined> {
  const [row] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  return row;
}

export async function getActiveTaskCountForUser(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        sql`${tasks.status} in ('QUEUED','DOWNLOADING','PROCESSING','UPLOADING')`,
      ),
    );
  return row?.count ?? 0;
}

export async function getActiveGlobalTaskCount(): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tasks)
    .where(sql`${tasks.status} in ('QUEUED','DOWNLOADING','PROCESSING','UPLOADING')`);
  return row?.count ?? 0;
}

export async function listRecentTasksForUser(userId: string, limit = 10): Promise<DbTask[]> {
  return db.select().from(tasks).where(eq(tasks.userId, userId)).orderBy(desc(tasks.createdAt)).limit(limit);
}
