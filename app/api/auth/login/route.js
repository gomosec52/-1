import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { cleanText } from '@/lib/config';
import { createSessionToken, setSessionCookie } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { friendlyError } from '@/lib/apiErrors';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const username = cleanText(body.username, 32);
    const password = String(body.password || '');

    const { data: user, error } = await supabaseAdmin()
      .from('app_users')
      .select('id, password_hash')
      .eq('provider', 'local')
      .ilike('username', username)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: friendlyError(error) }, { status: 500 });
    }

    const ok = user?.password_hash && await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return NextResponse.json({ error: 'Неверный ник или пароль' }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    setSessionCookie(response, await createSessionToken(user.id));
    return response;
  } catch (error) {
    return NextResponse.json({ error: friendlyError(error) }, { status: 500 });
  }
}
