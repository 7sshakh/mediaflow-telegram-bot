import type { Context, SessionFlavor } from "grammy";
import type { Locale } from "./i18n/locales";
import type { DbUser } from "@/db/repo/users";

export interface SessionData {
  awaitingMusicQuery?: boolean;
}

export type BotContext = Context &
  SessionFlavor<SessionData> & {
    dbUser: DbUser;
    locale: Locale;
  };
