import { NextResponse } from 'next/server';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { gamePayload } from '@/lib/gamePayload';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

async function requireAdminUser() {
  const user = await getCurrentUser();
  return isAdmin(user) ? user : null;
}

export async function PUT(request, { params }) {
  if (!await requireAdminUser()) {
    return NextResponse.json({ error: 'Нет доступа' }, { status: 403 });
  }

  const { id } = await params;
  const payload = gamePayload(await request.json().catch(() => ({})));
  if (!payload.title) return NextResponse.json({ error: 'Нужно название' }, { status: 400 });

  const { error } = await supabaseAdmin()
    .from('games')
    .update(payload)
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request, { params }) {
  if (!await requireAdminUser()) {
    return NextResponse.json({ error: 'Нет доступа' }, { status: 403 });
  }

  const { id } = await params;
  const { error } = await supabaseAdmin().from('games').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
