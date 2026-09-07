import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { downloads } from "@/db/schema";

export type DbDownload = typeof downloads.$inferSelect;

export async function createDownload(
  values: Omit<typeof downloads.$inferInsert, "id" | "createdAt">,
): Promise<DbDownload> {
  const [row] = await db
    .insert(downloads)
    .values({ id: randomUUID(), ...values })
    .returning();
  return row;
}

export async function findRecentCachedDownload(
  canonicalUrl: string,
  mediaType: "video" | "audio",
): Promise<DbDownload | undefined> {
  const [row] = await db
    .select()
    .from(downloads)
    .where(
      and(
        eq(downloads.canonicalUrl, canonicalUrl),
        eq(downloads.mediaType, mediaType),
        eq(downloads.status, "COMPLETED"),
        sql`${downloads.telegramFileId} is not null`,
      ),
    )
    .orderBy(desc(downloads.createdAt))
    .limit(1);
  return row;
}

export async function attachTelegramFile(
  downloadId: string,
  fileId: string,
  fileType: "video" | "audio",
) {
  await db
    .update(downloads)
    .set({ telegramFileId: fileId, telegramFileType: fileType })
    .where(eq(downloads.id, downloadId));
}

export async function getDownload(downloadId: string): Promise<DbDownload | undefined> {
  const [row] = await db.select().from(downloads).where(eq(downloads.id, downloadId)).limit(1);
  return row;
}

export async function listRecentDownloadsForUser(userId: string, limit = 10): Promise<DbDownload[]> {
  return db
    .select()
    .from(downloads)
    .where(eq(downloads.userId, userId))
    .orderBy(desc(downloads.createdAt))
    .limit(limit);
}

export async function deleteDownload(downloadId: string, userId: string) {
  await db.delete(downloads).where(and(eq(downloads.id, downloadId), eq(downloads.userId, userId)));
}

export async function countByPlatformSince(platform: string, since: Date): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(downloads)
    .where(and(eq(downloads.platform, platform), sql`${downloads.createdAt} >= ${since}`));
  return row?.count ?? 0;
}

export async function countDownloadsSince(since: Date): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(downloads)
    .where(sql`${downloads.createdAt} >= ${since}`);
  return row?.count ?? 0;
}

export async function countFailedSince(since: Date): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(downloads)
    .where(and(eq(downloads.status, "FAILED"), sql`${downloads.createdAt} >= ${since}`));
  return row?.count ?? 0;
}
