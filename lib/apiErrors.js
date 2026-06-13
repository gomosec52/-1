export function friendlyError(error) {
  const message = error?.message || String(error || 'Unknown error');

  if (message.includes('SUPABASE_URL') || message.includes('SUPABASE_SERVICE_ROLE_KEY')) {
    return 'Supabase не настроен: добавь SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в Environment Variables на Vercel.';
  }

  if (message.includes('AUTH_SECRET')) {
    return 'AUTH_SECRET не настроен: добавь длинный секрет в Environment Variables на Vercel.';
  }

  if (message.includes('relation') && message.includes('app_users')) {
    return 'База Supabase не готова: вставь свежий файл supabase/schema.sql в Supabase SQL Editor и нажми Run.';
  }

  if (message.includes('relation') && message.includes('does not exist')) {
    return 'В Supabase не созданы таблицы: вставь файл supabase/schema.sql целиком в SQL Editor.';
  }

  if (message.includes('Invalid API key') || message.includes('JWT')) {
    return 'Supabase ключ неверный: проверь SUPABASE_SERVICE_ROLE_KEY в Vercel Environment Variables.';
  }

  return message;
}
