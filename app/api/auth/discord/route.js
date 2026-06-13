import { nanoid } from 'nanoid';
import { NextResponse } from 'next/server';
import { siteUrl } from '@/lib/config';

export async function GET() {
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) {
    return new NextResponse('DISCORD_CLIENT_ID is not configured', { status: 500 });
  }

  const state = nanoid(24);
  const redirectUri = `${siteUrl()}/api/auth/discord/callback`;
  const url = new URL('https://discord.com/oauth2/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', 'identify');
  url.searchParams.set('state', state);

  const response = NextResponse.redirect(url);
  response.cookies.set('discord_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 10
  });
  return response;
}
