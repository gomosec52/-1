import { cookies } from 'next/headers';
import { jwtVerify, SignJWT } from 'jose';
import { adminIds, publicUser, requiredEnv } from './config';
import { supabaseAdmin } from './supabaseAdmin';

const COOKIE_NAME = 'game_packs_session';
const MAX_AGE = 60 * 60 * 24 * 30;

function secretKey() {
  return new TextEncoder().encode(requiredEnv('AUTH_SECRET'));
}

export async function createSessionToken(userId) {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token) {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload.sub || null;
  } catch {
    return null;
  }
}

export function setSessionCookie(response, token) {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE
  });
}

export function clearSessionCookie(response) {
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0
  });
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const userId = await verifySessionToken(token);
  if (!userId) return null;

  const { data, error } = await supabaseAdmin()
    .from('users')
    .select('id, public_id, provider, username, avatar_url')
    .eq('id', userId)
    .single();

  if (error || !data) return null;
  return publicUser(data);
}

export function isAdmin(user) {
  return !!user && adminIds().includes(user.public_id);
}
