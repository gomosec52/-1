import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { friendlyError } from '@/lib/apiErrors';

export async function POST(request, { params }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Нужно войти заново: сессия не найдена или истекла.' }, { status: 401 });

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const choice = body.choice === 'no' ? 'no' : 'yes';
    const db = supabaseAdmin();

    const { data: game, error: gameError } = await db.from('games').select('id').eq('id', id).maybeSingle();
    if (gameError) return NextResponse.json({ error: friendlyError(gameError) }, { status: 500 });
    if (!game) return NextResponse.json({ error: 'Игра не найдена' }, { status: 404 });

    const { error } = await db
      .from('votes')
      .upsert({ user_id: user.id, game_id: game.id, choice }, { onConflict: 'user_id,game_id' });

    if (error) return NextResponse.json({ error: friendlyError(error) }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: friendlyError(error) }, { status: 500 });
  }
}
