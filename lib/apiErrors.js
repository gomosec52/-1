export function friendlyError(error) {
  const message = error?.message || String(error || 'Unknown error');

  if (message.includes('SUPABASE_URL') || message.includes('SUPABASE_SERVICE_ROLE_KEY')) {
    return 'Supabase не настроен: добавь SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в Environment Variables на Vercel.';
  }

  if (message.includes('Invalid path specified in request URL')) {
    return 'SUPABASE_URL указан неправильно. В Vercel вставь Project URL вида https://xxxxx.supabase.co без /rest/v1 и без /auth/v1 на конце.';
  }

  if (message.includes('AUTH_SECRET')) {
    return 'AUTH_SECRET не настроен: добавь длинный секрет в Environment Variables на Vercel.';
  }

  if (message.includes('relation') && message.includes('app_users')) {
    return 'База Supabase не готова: вставь свежий файл supabase/schema.sql в Supabase SQL Editor и нажми Run.';
  }

  if (message.includes('schema cache') || message.includes('Could not find the table')) {
    return 'Supabase не видит нужные таблицы. Выполни свежий supabase/schema.sql целиком и подожди несколько секунд.';
  }

  if (message.includes('relation') && message.includes('does not exist')) {
    return 'В Supabase не созданы таблицы: вставь файл supabase/schema.sql целиком в SQL Editor.';
  }

  if (message.includes('foreign key constraint')) {
    return 'Связи таблиц Supabase устарели. Открой Supabase SQL Editor и заново выполни свежий supabase/schema.sql целиком.';
  }

  if (message.includes('Invalid API key') || message.includes('JWT')) {
    return 'Supabase ключ неверный: проверь SUPABASE_SERVICE_ROLE_KEY в Vercel Environment Variables.';
  }

  return message;
}
