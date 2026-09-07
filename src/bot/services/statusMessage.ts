import type { BotContext } from "@/bot/types";
import type { InlineKeyboard } from "grammy";

/** Wraps a single Telegram message and edits it in place, throttling updates. */
export class StatusMessage {
  private chatId: number;
  private messageId: number;
  private lastEditAt = 0;
  private lastText = "";

  private constructor(chatId: number, messageId: number, private ctx: BotContext) {
    this.chatId = chatId;
    this.messageId = messageId;
  }

  static async send(ctx: BotContext, text: string, keyboard?: InlineKeyboard): Promise<StatusMessage> {
    const msg = await ctx.reply(text, keyboard ? { reply_markup: keyboard } : undefined);
    const status = new StatusMessage(msg.chat.id, msg.message_id, ctx);
    status.lastText = text;
    return status;
  }

  async update(text: string, keyboard?: InlineKeyboard, force = false): Promise<void> {
    const now = Date.now();
    if (!force && now - this.lastEditAt < 1200 && text === this.lastText) return;
    if (text === this.lastText && !keyboard) return;
    this.lastEditAt = now;
    this.lastText = text;
    try {
      await this.ctx.api.editMessageText(this.chatId, this.messageId, text, {
        reply_markup: keyboard,
      });
    } catch {
      /* message may be unchanged or already deleted — safe to ignore */
    }
  }

  async remove(): Promise<void> {
    try {
      await this.ctx.api.deleteMessage(this.chatId, this.messageId);
    } catch {
      /* ignore */
    }
  }
}
