import { randomUUID } from "node:crypto";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { musicRecognitions } from "@/db/schema";

export type DbRecognition = typeof musicRecognitions.$inferSelect;

export async function createRecognition(
  values: Omit<typeof musicRecognitions.$inferInsert, "id" | "createdAt">,
): Promise<DbRecognition> {
  const [row] = await db
    .insert(musicRecognitions)
    .values({ id: randomUUID(), ...values })
    .returning();
  return row;
}

export async function findRecognitionByDownload(downloadId: string): Promise<DbRecognition | undefined> {
  const [row] = await db
    .select()
    .from(musicRecognitions)
    .where(eq(musicRecognitions.downloadId, downloadId))
    .orderBy(desc(musicRecognitions.createdAt))
    .limit(1);
  return row;
}

export async function getRecognition(id: string): Promise<DbRecognition | undefined> {
  const [row] = await db.select().from(musicRecognitions).where(eq(musicRecognitions.id, id)).limit(1);
  return row;
}

export async function countRecognitionsSince(since: Date): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(musicRecognitions)
    .where(sql`${musicRecognitions.createdAt} >= ${since}`);
  return row?.count ?? 0;
}
