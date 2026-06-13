import { NextResponse } from 'next/server';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { gamePayload } from '@/lib/gamePayload';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

async function requireAdminUser() {
  const user = await getCurrentUser();
  return isAdmin(user) ? user : null;
}

export async function GET() {
  if (!await requireAdminUser()) {
    return NextResponse.json({ error: 'Нет доступа' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin()
    .from('games')
    .select('*')
    .order('pack', { ascending: true })
    .order('id', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ games: data || [] });
}

export async function POST(request) {
  if (!await requireAdminUser()) {
    return NextResponse.json({ error: 'Нет доступа' }, { status: 403 });
  }

  const payload = gamePayload(await request.json().catch(() => ({})));
  if (!payload.title) return NextResponse.json({ error: 'Нужно название' }, { status: 400 });

  const { error } = await supabaseAdmin().from('games').insert(payload);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
