import { cookies } from 'next/headers';
import { nanoid } from 'nanoid';
import { NextResponse } from 'next/server';
import { cleanText, defaultAvatar, siteUrl } from '@/lib/config';
import { createSessionToken, setSessionCookie } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const state = requestUrl.searchParams.get('state');
  const cookieStore = await cookies();
  const savedState = cookieStore.get('discord_oauth_state')?.value;

  if (!code || !state || state !== savedState) {
    return NextResponse.redirect(`${siteUrl()}/?authError=discord_state`);
  }

  const redirectUri = `${siteUrl()}/api/auth/discord/callback`;
  const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID || '',
      client_secret: process.env.DISCORD_CLIENT_SECRET || '',
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri
    })
  });
  const token = await tokenResponse.json();

  if (!token.access_token) {
    return NextResponse.redirect(`${siteUrl()}/?authError=discord_token`);
  }

  const discordResponse = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${token.access_token}` }
  });
  const discordUser = await discordResponse.json();
  const username = cleanText(discordUser.global_name || discordUser.username || 'Discord user', 32);
  const avatarUrl = discordUser.avatar
    ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=160`
    : defaultAvatar(username);

  const db = supabaseAdmin();
  const { data: existing } = await db
    .from('app_users')
    .select('id')
    .eq('discord_id', discordUser.id)
    .maybeSingle();

  let userId = existing?.id;
  if (userId) {
    const { error } = await db
      .from('app_users')
      .update({ username, avatar_url: avatarUrl })
      .eq('id', userId);
    if (error) return NextResponse.redirect(`${siteUrl()}/?authError=discord_save`);
  } else {
    const { data: created, error } = await db
      .from('app_users')
      .insert({
        public_id: `u_${nanoid(10)}`,
        provider: 'discord',
        discord_id: discordUser.id,
        username,
        avatar_url: avatarUrl
      })
      .select('id')
      .single();

    if (error) return NextResponse.redirect(`${siteUrl()}/?authError=discord_save`);
    userId = created.id;
  }

  const response = NextResponse.redirect(siteUrl());
  response.cookies.set('discord_oauth_state', '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0
  });
  setSessionCookie(response, await createSessionToken(userId));
  return response;
}
