import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { youtubeSearches } from "@/db/schema";
import type { NormalizedYouTubeResult } from "@/services/youtube/types";

export type DbSearch = typeof youtubeSearches.$inferSelect;

export async function createSearch(
  userId: string,
  query: string,
  results: NormalizedYouTubeResult[],
): Promise<DbSearch> {
  const [row] = await db
    .insert(youtubeSearches)
    .values({ id: randomUUID(), userId, query, resultsJson: results })
    .returning();
  return row;
}

export async function getSearch(id: string): Promise<DbSearch | undefined> {
  const [row] = await db.select().from(youtubeSearches).where(eq(youtubeSearches.id, id)).limit(1);
  return row;
}
