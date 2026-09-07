export type Locale = "uz" | "ru" | "en";

export interface Dictionary {
  start_welcome: string;
  start_cta_download: string;
  start_cta_music: string;
  start_cta_settings: string;
  menu_download: string;
  menu_music: string;
  menu_history: string;
  menu_settings: string;
  menu_help: string;
  menu_back: string;
  help_text: string;
  ask_for_link: string;
  ask_for_music_query: string;
  status_checking: string;
  status_platform_detected: string;
  status_downloading: string;
  status_processing_audio: string;
  status_recognizing: string;
  status_ready: string;
  status_cancelled: string;
  error_generic: string;
  error_invalid_url: string;
  error_unsupported_domain: string;
  error_private_network: string;
  error_unavailable: string;
  error_too_long: string;
  error_too_large: string;
  error_rate_limited: string;
  error_daily_limit: string;
  error_concurrent_limit: string;
  error_blocked: string;
  btn_music: string;
  btn_audio: string;
  btn_video: string;
  btn_download_again: string;
  btn_share: string;
  btn_cancel: string;
  btn_open_youtube: string;
  btn_more_results: string;
  btn_search_music: string;
  music_found_title: string;
  music_not_confirmed: string;
  music_field_title: string;
  music_field_artist: string;
  music_field_album: string;
  music_no_key: string;
  music_no_match: string;
  youtube_results_title: string;
  youtube_no_results: string;
  history_title: string;
  history_empty: string;
  settings_title: string;
  settings_language: string;
  settings_audio_quality: string;
  settings_video_quality: string;
  lang_choose: string;
  lang_saved: string;
  admin_menu_title: string;
  admin_not_authorized: string;
  admin_stats_title: string;
  cancel_confirm: string;
}

export const dictionaries: Record<Locale, Dictionary> = {
  en: {
    start_welcome:
      "👋 Welcome to <b>MediaFlow</b>!\n\nSend me a TikTok, Instagram or YouTube link and I'll process it for you.\n\n🎬 Video Downloader\n🎵 Music Recognition\n🔎 YouTube Search\n⚡ Fast Processing",
    start_cta_download: "📥 Download Media",
    start_cta_music: "🎵 Music",
    start_cta_settings: "⚙️ Settings",
    menu_download: "🎬 Download Media",
    menu_music: "🎵 Music",
    menu_history: "📥 My Downloads",
    menu_settings: "⚙️ Settings",
    menu_help: "ℹ️ Help",
    menu_back: "⬅️ Back",
    help_text:
      "<b>ℹ️ Help</b>\n\n<b>Supported platforms:</b> TikTok, Instagram (public posts/reels), YouTube & Shorts.\n\n<b>How to download:</b> just send the link.\n<b>Identify music:</b> tap 🔎 Music under any downloaded video.\n<b>YouTube search:</b> type a song name after tapping 🎵 Music.\n\n<b>Limits:</b> max file size and duration are configured by the admin. Excess requests are queued automatically.\n\n<b>Privacy:</b> downloaded files are temporary and deleted shortly after delivery.\n<b>Copyright:</b> only download public content you have the right to use.",
    ask_for_link: "Send me a TikTok, Instagram or YouTube link 🔗",
    ask_for_music_query: "🎵 Type a song name or artist to search on YouTube.",
    status_checking: "🔎 Checking link...",
    status_platform_detected: "📡 Platform detected: {platform}",
    status_downloading: "📥 Downloading media...",
    status_processing_audio: "🎵 Preparing audio...",
    status_recognizing: "🔍 Identifying music...",
    status_ready: "✅ Done!",
    status_cancelled: "❌ Download cancelled.",
    error_generic: "❌ Something went wrong.\n\nReason:\n{reason}",
    error_invalid_url: "❌ This doesn't look like a valid link.",
    error_unsupported_domain: "❌ This platform isn't supported yet.",
    error_private_network: "❌ This link points to a blocked/internal address and cannot be processed.",
    error_unavailable: "❌ Couldn't download the video.\n\nReason:\nThe media is unavailable or the platform restricted downloading.",
    error_too_long: "⚠️ This video is longer than the allowed limit ({limit} min).",
    error_too_large: "⚠️ File is too large for Telegram's limit.",
    error_rate_limited: "🐢 Too many requests. Please wait a bit and try again.",
    error_daily_limit: "🚫 You've reached your daily download limit.",
    error_concurrent_limit: "⏳ You already have an active download. Please wait for it to finish.",
    error_blocked: "🚫 Your account has been blocked from using this bot.",
    btn_music: "🔎 Music",
    btn_audio: "🎵 Audio",
    btn_video: "🎬 Video",
    btn_download_again: "⬇️ Download Again",
    btn_share: "📤 Share",
    btn_cancel: "❌ Cancel",
    btn_open_youtube: "▶️ Open YouTube",
    btn_more_results: "🔎 More Results",
    btn_search_music: "🎵 Search Music",
    music_found_title: "🎵 Music found",
    music_not_confirmed: "🤔 Exact match not confirmed. Here's what we found:",
    music_field_title: "Title",
    music_field_artist: "Artist",
    music_field_album: "Album",
    music_no_key: "⚙️ Music recognition isn't configured yet. Ask the bot admin to set MUSIC_API_KEY.",
    music_no_match: "😕 Couldn't identify the music in this video. Try 🎵 Search Music to look it up manually.",
    youtube_results_title: "🎵 Results for \"{query}\"",
    youtube_no_results: "😕 No YouTube results found.",
    history_title: "📥 Your recent downloads",
    history_empty: "You haven't downloaded anything yet.",
    settings_title: "⚙️ Settings",
    settings_language: "🌐 Language",
    settings_audio_quality: "🎵 Audio quality",
    settings_video_quality: "📹 Video quality",
    lang_choose: "Choose your language:",
    lang_saved: "✅ Language updated.",
    admin_menu_title: "🛠 Admin panel",
    admin_not_authorized: "🚫 You are not authorized to use this command.",
    admin_stats_title: "📊 Statistics",
    cancel_confirm: "Cancelling...",
  },
  ru: {
    start_welcome:
      "👋 Добро пожаловать в <b>MediaFlow</b>!\n\nОтправьте ссылку из TikTok, Instagram или YouTube — я всё обработаю.\n\n🎬 Скачивание видео\n🎵 Распознавание музыки\n🔎 Поиск на YouTube\n⚡ Быстрая обработка",
    start_cta_download: "📥 Скачать медиа",
    start_cta_music: "🎵 Музыка",
    start_cta_settings: "⚙️ Настройки",
    menu_download: "🎬 Скачать медиа",
    menu_music: "🎵 Музыка",
    menu_history: "📥 Мои загрузки",
    menu_settings: "⚙️ Настройки",
    menu_help: "ℹ️ Помощь",
    menu_back: "⬅️ Назад",
    help_text:
      "<b>ℹ️ Помощь</b>\n\n<b>Платформы:</b> TikTok, Instagram (публичные посты/рилсы), YouTube и Shorts.\n\n<b>Как скачать:</b> просто отправьте ссылку.\n<b>Распознать музыку:</b> нажмите 🔎 Музыка под видео.\n<b>Поиск YouTube:</b> введите название песни после нажатия 🎵 Музыка.\n\n<b>Лимиты:</b> максимальный размер и длительность файла настраиваются администратором.\n\n<b>Приватность:</b> файлы временные и удаляются вскоре после отправки.\n<b>Авторские права:</b> скачивайте только тот публичный контент, на использование которого у вас есть право.",
    ask_for_link: "Отправьте ссылку из TikTok, Instagram или YouTube 🔗",
    ask_for_music_query: "🎵 Введите название песни или исполнителя для поиска на YouTube.",
    status_checking: "🔎 Проверка ссылки...",
    status_platform_detected: "📡 Платформа определена: {platform}",
    status_downloading: "📥 Видео загружается...",
    status_processing_audio: "🎵 Подготовка аудио...",
    status_recognizing: "🔍 Распознавание музыки...",
    status_ready: "✅ Готово!",
    status_cancelled: "❌ Загрузка отменена.",
    error_generic: "❌ Что-то пошло не так.\n\nПричина:\n{reason}",
    error_invalid_url: "❌ Это не похоже на корректную ссылку.",
    error_unsupported_domain: "❌ Эта платформа пока не поддерживается.",
    error_private_network: "❌ Ссылка ведёт на заблокированный/внутренний адрес и не может быть обработана.",
    error_unavailable: "❌ Не удалось скачать видео.\n\nПричина:\nМедиа недоступно или платформа ограничила загрузку.",
    error_too_long: "⚠️ Видео длиннее допустимого лимита ({limit} мин).",
    error_too_large: "⚠️ Файл слишком большой из-за лимита Telegram.",
    error_rate_limited: "🐢 Слишком много запросов. Подождите немного.",
    error_daily_limit: "🚫 Вы достигли дневного лимита загрузок.",
    error_concurrent_limit: "⏳ У вас уже есть активная загрузка. Дождитесь её завершения.",
    error_blocked: "🚫 Ваш аккаунт заблокирован в этом боте.",
    btn_music: "🔎 Музыка",
    btn_audio: "🎵 Аудио",
    btn_video: "🎬 Видео",
    btn_download_again: "⬇️ Скачать снова",
    btn_share: "📤 Поделиться",
    btn_cancel: "❌ Отмена",
    btn_open_youtube: "▶️ Открыть YouTube",
    btn_more_results: "🔎 Ещё результаты",
    btn_search_music: "🎵 Искать музыку",
    music_found_title: "🎵 Музыка найдена",
    music_not_confirmed: "🤔 Точное совпадение не подтверждено. Вот что удалось найти:",
    music_field_title: "Название",
    music_field_artist: "Исполнитель",
    music_field_album: "Альбом",
    music_no_key: "⚙️ Распознавание музыки ещё не настроено. Попросите администратора указать MUSIC_API_KEY.",
    music_no_match: "😕 Не удалось распознать музыку в этом видео. Попробуйте 🎵 Искать музыку вручную.",
    youtube_results_title: "🎵 Результаты по запросу «{query}»",
    youtube_no_results: "😕 Результаты на YouTube не найдены.",
    history_title: "📥 Ваши последние загрузки",
    history_empty: "Вы пока ничего не скачивали.",
    settings_title: "⚙️ Настройки",
    settings_language: "🌐 Язык",
    settings_audio_quality: "🎵 Качество аудио",
    settings_video_quality: "📹 Качество видео",
    lang_choose: "Выберите язык:",
    lang_saved: "✅ Язык обновлён.",
    admin_menu_title: "🛠 Панель администратора",
    admin_not_authorized: "🚫 У вас нет доступа к этой команде.",
    admin_stats_title: "📊 Статистика",
    cancel_confirm: "Отмена...",
  },
  uz: {
    start_welcome:
      "👋 <b>MediaFlow</b>ga xush kelibsiz!\n\nTikTok, Instagram yoki YouTube havolasini yuboring — men uni qayta ishlayman.\n\n🎬 Video yuklovchi\n🎵 Musiqani aniqlash\n🔎 YouTube qidiruvi\n⚡ Tezkor ishlash",
    start_cta_download: "📥 Media yuklash",
    start_cta_music: "🎵 Musiqa",
    start_cta_settings: "⚙️ Sozlamalar",
    menu_download: "🎬 Media yuklash",
    menu_music: "🎵 Musiqa",
    menu_history: "📥 Yuklamalarim",
    menu_settings: "⚙️ Sozlamalar",
    menu_help: "ℹ️ Yordam",
    menu_back: "⬅️ Orqaga",
    help_text:
      "<b>ℹ️ Yordam</b>\n\n<b>Platformalar:</b> TikTok, Instagram (ochiq post/reels), YouTube va Shorts.\n\n<b>Yuklash:</b> shunchaki havolani yuboring.\n<b>Musiqani aniqlash:</b> video ostidagi 🔎 Musiqa tugmasini bosing.\n<b>YouTube qidiruv:</b> 🎵 Musiqa tugmasidan so'ng qo'shiq nomini yozing.\n\n<b>Cheklovlar:</b> maksimal fayl hajmi va davomiylik administrator tomonidan sozlanadi.\n\n<b>Maxfiylik:</b> yuklangan fayllar vaqtinchalik bo'lib, yuborilgandan so'ng tezda o'chiriladi.\n<b>Mualliflik huquqi:</b> faqat foydalanish huquqingiz bo'lgan ochiq kontentni yuklang.",
    ask_for_link: "TikTok, Instagram yoki YouTube havolasini yuboring 🔗",
    ask_for_music_query: "🎵 YouTube'dan qidirish uchun qo'shiq nomi yoki ijrochini yozing.",
    status_checking: "🔎 Havola tekshirilmoqda...",
    status_platform_detected: "📡 Platforma aniqlandi: {platform}",
    status_downloading: "📥 Media yuklanmoqda...",
    status_processing_audio: "🎵 Audio tayyorlanmoqda...",
    status_recognizing: "🔍 Musiqa aniqlanmoqda...",
    status_ready: "✅ Tayyor!",
    status_cancelled: "❌ Yuklash bekor qilindi.",
    error_generic: "❌ Nimadir xato ketdi.\n\nSabab:\n{reason}",
    error_invalid_url: "❌ Bu to'g'ri havolaga o'xshamayapti.",
    error_unsupported_domain: "❌ Bu platforma hali qo'llab-quvvatlanmaydi.",
    error_private_network: "❌ Havola bloklangan/ichki manzilga yo'naltirilgan, uni qayta ishlab bo'lmaydi.",
    error_unavailable: "❌ Videoni yuklab bo'lmadi.\n\nSabab:\nMedia hozir mavjud emas yoki platforma yuklashni cheklagan.",
    error_too_long: "⚠️ Bu video ruxsat etilgan chegaradan uzunroq ({limit} daqiqa).",
    error_too_large: "⚠️ Fayl Telegram limiti sabab juda katta.",
    error_rate_limited: "🐢 So'rovlar juda ko'p. Birozdan so'ng qayta urinib ko'ring.",
    error_daily_limit: "🚫 Kunlik yuklash limitiga yetdingiz.",
    error_concurrent_limit: "⏳ Sizda faol yuklash mavjud. Iltimos, u tugashini kuting.",
    error_blocked: "🚫 Hisobingiz botdan foydalanishdan bloklangan.",
    btn_music: "🔎 Musiqa",
    btn_audio: "🎵 Audio",
    btn_video: "🎬 Video",
    btn_download_again: "⬇️ Qayta yuklash",
    btn_share: "📤 Ulashish",
    btn_cancel: "❌ Bekor qilish",
    btn_open_youtube: "▶️ YouTube'da ochish",
    btn_more_results: "🔎 Ko'proq natijalar",
    btn_search_music: "🎵 Musiqa qidirish",
    music_found_title: "🎵 Musiqa topildi",
    music_not_confirmed: "🤔 Aniq moslik tasdiqlanmadi. Topilganlar:",
    music_field_title: "Nomi",
    music_field_artist: "Ijrochi",
    music_field_album: "Albom",
    music_no_key: "⚙️ Musiqani aniqlash hali sozlanmagan. Administratordan MUSIC_API_KEY ni sozlashni so'rang.",
    music_no_match: "😕 Bu videodagi musiqani aniqlab bo'lmadi. 🎵 Musiqa qidirish orqali qo'lda izlab ko'ring.",
    youtube_results_title: "🎵 \"{query}\" bo'yicha natijalar",
    youtube_no_results: "😕 YouTube'dan natija topilmadi.",
    history_title: "📥 So'nggi yuklamalaringiz",
    history_empty: "Siz hali hech narsa yuklamadingiz.",
    settings_title: "⚙️ Sozlamalar",
    settings_language: "🌐 Til",
    settings_audio_quality: "🎵 Audio sifati",
    settings_video_quality: "📹 Video sifati",
    lang_choose: "Tilni tanlang:",
    lang_saved: "✅ Til yangilandi.",
    admin_menu_title: "🛠 Admin panel",
    admin_not_authorized: "🚫 Sizda bu buyruqdan foydalanish huquqi yo'q.",
    admin_stats_title: "📊 Statistika",
    cancel_confirm: "Bekor qilinmoqda...",
  },
};

export function t(locale: Locale, key: keyof Dictionary, vars?: Record<string, string | number>): string {
  let str = dictionaries[locale][key] ?? dictionaries.en[key];
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replaceAll(`{${k}}`, String(v));
    }
  }
  return str;
}
