// ============================================================
//  НАСТРОЙКИ — ЗАПОЛНИ ЭТИ ЗНАЧЕНИЯ ПОСЛЕ СОЗДАНИЯ СЕРВИСОВ
// ============================================================

const CONFIG = {
  // --- Supabase ---
  SUPABASE_URL:  'https://jdpubonupygascsbhddo.supabase.co',     // замени
  SUPABASE_ANON: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkcHVib251cHlnYXNjc2JoZGRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNTA1ODEsImV4cCI6MjA5NjcyNjU4MX0.wFhoRVUjUKLw5RAWeuyMlmoH53t7QyTyuVK-m2jbKh0',                        // замени

  // --- Discord OAuth2 ---
  DISCORD_CLIENT_ID: '1514488763143688292',                   // замени
  // Redirect URI должен совпадать с тем, что в Discord Developer Portal:
  // https://gamesite-topaz.vercel.app/pages/discord-callback.html

  // --- Админ IDs (Discord ID или site_id) ---
  // После первого входа через Discord скопируй свой ID из шапки и вставь сюда
  ADMIN_IDS: ['GD-KOEBPYL'],                        // замени

  // --- Default avatar для обычной регистрации ---
  DEFAULT_AVATAR: 'https://api.dicebear.com/7.x/bottts/svg?seed=',
};

// Делаем доступным глобально
window.CONFIG = CONFIG;
