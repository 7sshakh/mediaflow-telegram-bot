import { InlineKeyboard } from "grammy";
import type { Locale } from "@/bot/i18n/locales";
import { t } from "@/bot/i18n/locales";
import { encodeCallback } from "@/bot/utils/callbackData";
import type { NormalizedYouTubeResult } from "@/services/youtube/types";

export function mainMenuKeyboard(locale: Locale): InlineKeyboard {
  return new InlineKeyboard()
    .text(t(locale, "menu_download"), encodeCallback("menu", ["download"]))
    .text(t(locale, "menu_music"), encodeCallback("menu", ["music"]))
    .row()
    .text(t(locale, "menu_history"), encodeCallback("menu", ["history"]))
    .text(t(locale, "menu_settings"), encodeCallback("menu", ["settings"]))
    .row()
    .text(t(locale, "menu_help"), encodeCallback("menu", ["help"]));
}

export function backToMenuKeyboard(locale: Locale): InlineKeyboard {
  return new InlineKeyboard().text(t(locale, "menu_back"), encodeCallback("menu", ["root"]));
}

export function cancelKeyboard(locale: Locale, taskId: string): InlineKeyboard {
  return new InlineKeyboard().text(t(locale, "btn_cancel"), encodeCallback("cancel", [taskId]));
}

/** Buttons shown under every successfully delivered video/audio. */
export function mediaActionsKeyboard(locale: Locale, downloadId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text(t(locale, "btn_music"), encodeCallback("music", [downloadId]))
    .row()
    .text(t(locale, "btn_audio"), encodeCallback("dlagain", [downloadId, "audio"]))
    .text(t(locale, "btn_download_again"), encodeCallback("dlagain", [downloadId, "video"]))
    .row()
    .text(t(locale, "btn_share"), encodeCallback("share", [downloadId]));
}

export function recognitionResultKeyboard(locale: Locale, recognitionId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text(t(locale, "btn_open_youtube"), encodeCallback("ytsearch_from_rec", [recognitionId]))
    .row()
    .text(t(locale, "btn_search_music"), encodeCallback("music_search_manual", []));
}

export function recognitionCandidatesKeyboard(
  locale: Locale,
  recognitionId: string,
  candidates: Array<{ title: string; artist: string }>,
): InlineKeyboard {
  const kb = new InlineKeyboard();
  candidates.slice(0, 10).forEach((c, idx) => {
    kb.text(`🎵 ${c.title} — ${c.artist}`.slice(0, 64), encodeCallback("rec_pick", [recognitionId, idx])).row();
  });
  return kb;
}

export function youtubeResultsKeyboard(
  locale: Locale,
  searchId: string,
  results: NormalizedYouTubeResult[],
  page: number,
  pageSize = 5,
): InlineKeyboard {
  const kb = new InlineKeyboard();
  const start = page * pageSize;
  const pageItems = results.slice(start, start + pageSize);
  pageItems.forEach((r, idx) => {
    const globalIndex = start + idx;
    kb.text(`${globalIndex + 1}. ${r.title}`.slice(0, 64), encodeCallback("yt_item", [searchId, globalIndex])).row();
  });

  const totalPages = Math.ceil(results.length / pageSize);
  if (totalPages > 1) {
    const nav = new InlineKeyboard();
    if (page > 0) nav.text("⬅️", encodeCallback("yt_page", [searchId, page - 1]));
    nav.text(`${page + 1}/${totalPages}`, encodeCallback("noop", []));
    if (page < totalPages - 1) nav.text("➡️", encodeCallback("yt_page", [searchId, page + 1]));
    kb.row(...nav.inline_keyboard[0]);
  }
  return kb;
}

export function youtubeItemKeyboard(locale: Locale, searchId: string, index: number, url: string): InlineKeyboard {
  return new InlineKeyboard()
    .url(t(locale, "btn_open_youtube"), url)
    .row()
    .text(t(locale, "btn_audio"), encodeCallback("yt_dl", [searchId, index, "audio"]))
    .text(t(locale, "btn_video"), encodeCallback("yt_dl", [searchId, index, "video"]));
}

export function settingsKeyboard(locale: Locale): InlineKeyboard {
  return new InlineKeyboard()
    .text(t(locale, "settings_language"), encodeCallback("settings", ["lang"]))
    .row()
    .text(t(locale, "settings_audio_quality"), encodeCallback("settings", ["audio"]))
    .row()
    .text(t(locale, "settings_video_quality"), encodeCallback("settings", ["video"]))
    .row()
    .text(t(locale, "menu_back"), encodeCallback("menu", ["root"]));
}

export function languageKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🇺🇿 O'zbekcha", encodeCallback("lang_set", ["uz"]))
    .row()
    .text("🇷🇺 Русский", encodeCallback("lang_set", ["ru"]))
    .row()
    .text("🇬🇧 English", encodeCallback("lang_set", ["en"]));
}

export function audioQualityKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("128 kbps", encodeCallback("audioq_set", ["128"]))
    .text("192 kbps", encodeCallback("audioq_set", ["192"]))
    .text("320 kbps", encodeCallback("audioq_set", ["320"]));
}

export function videoQualityKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Best", encodeCallback("videoq_set", ["best"]))
    .text("1080p", encodeCallback("videoq_set", ["1080"]))
    .row()
    .text("720p", encodeCallback("videoq_set", ["720"]))
    .text("480p", encodeCallback("videoq_set", ["480"]));
}

export function historyItemKeyboard(locale: Locale, downloadId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text(t(locale, "btn_music"), encodeCallback("music", [downloadId]))
    .text(t(locale, "btn_download_again"), encodeCallback("dlagain", [downloadId, "video"]));
}

export function adminMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("📊 Statistics", encodeCallback("admin", ["stats"]))
    .row()
    .text("👥 Users", encodeCallback("admin", ["users"]))
    .text("📥 Downloads", encodeCallback("admin", ["downloads"]))
    .row()
    .text("🎵 Music Recognition", encodeCallback("admin", ["music"]))
    .row()
    .text("🧹 Cleanup", encodeCallback("admin", ["cleanup"]))
    .text("🔧 System Status", encodeCallback("admin", ["system"]));
}
