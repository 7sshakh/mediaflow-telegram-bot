import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { isAdmin } from "@/core/config";

export type DbUser = typeof users.$inferSelect;

export interface TelegramIdentity {
  telegramId: number;
  username?: string | null;
  firstName?: string | null;
  languageCode?: string | null;
}

/** Normalize a Telegram language_code (e.g. "ru-RU") to a supported app locale. */
export function normalizeLocale(code?: string | null): "uz" | "ru" | "en" {
  const lc = (code ?? "").toLowerCase();
  if (lc.startsWith("ru")) return "ru";
  if (lc.startsWith("uz")) return "uz";
  return "en";
}

export async function getOrCreateUser(identity: TelegramIdentity): Promise<DbUser> {
  const found = (
    await db.select().from(users).where(eq(users.telegramId, identity.telegramId)).limit(1)
  )[0];

  if (found) {
    await db
      .update(users)
      .set({ lastActiveAt: new Date(), username: identity.username ?? found.username })
      .where(eq(users.id, found.id));
    return found;
  }

  const role = isAdmin(identity.telegramId) ? "admin" : "user";
  const plan = isAdmin(identity.telegramId) ? "admin" : "free";

  const [created] = await db
    .insert(users)
    .values({
      id: randomUUID(),
      telegramId: identity.telegramId,
      username: identity.username ?? null,
      firstName: identity.firstName ?? null,
      languageCode: normalizeLocale(identity.languageCode),
      role,
      plan,
    })
    .returning();

  return created;
}

export async function setUserLanguage(userId: string, languageCode: "uz" | "ru" | "en") {
  await db.update(users).set({ languageCode }).where(eq(users.id, userId));
}

export async function updateUserSettings(userId: string, patch: Partial<DbUser["settings"]>) {
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!row) return;
  await db
    .update(users)
    .set({ settings: { ...row.settings, ...patch } })
    .where(eq(users.id, userId));
}

export async function setUserBlocked(telegramId: number, blocked: boolean) {
  await db.update(users).set({ isBlocked: blocked }).where(eq(users.telegramId, telegramId));
}

export async function getUserByTelegramId(telegramId: number): Promise<DbUser | undefined> {
  const [row] = await db.select().from(users).where(eq(users.telegramId, telegramId)).limit(1);
  return row;
}

export async function countUsers(): Promise<number> {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
  return row?.count ?? 0;
}

export async function countActiveUsersSince(date: Date): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(sql`${users.lastActiveAt} >= ${date}`);
  return row?.count ?? 0;
}
