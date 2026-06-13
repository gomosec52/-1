import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { NextResponse } from 'next/server';
import { cleanText, defaultAvatar } from '@/lib/config';
import { createSessionToken, setSessionCookie } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const username = cleanText(body.username, 32);
  const password = String(body.password || '');

  if (username.length < 2 || password.length < 4) {
    return NextResponse.json({ error: 'Ник от 2 символов, пароль от 4' }, { status: 400 });
  }
  if (password.length > 200) {
    return NextResponse.json({ error: 'Слишком длинный пароль' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: existing } = await db
    .from('users')
    .select('id')
    .eq('provider', 'local')
    .ilike('username', username)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'Такой ник уже занят' }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const { data: user, error } = await db
    .from('users')
    .insert({
      public_id: `u_${nanoid(10)}`,
      provider: 'local',
      username,
      password_hash: passwordHash,
      avatar_url: defaultAvatar(username)
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true });
  setSessionCookie(response, await createSessionToken(user.id));
  return response;
}
