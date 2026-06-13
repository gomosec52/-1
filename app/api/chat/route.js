import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { cleanText } from '@/lib/config';
import { getChatMessages } from '@/lib/data';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { friendlyError } from '@/lib/apiErrors';

export async function GET() {
  try {
    const messages = await getChatMessages();
    return NextResponse.json({ messages });
  } catch (error) {
    return NextResponse.json({ error: friendlyError(error) }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Нужно войти заново: сессия не найдена или истекла.' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const message = cleanText(body.message, 300);
    if (!message) return NextResponse.json({ error: 'Пустое сообщение' }, { status: 400 });

    const { error } = await supabaseAdmin()
      .from('chat_messages')
      .insert({ user_id: user.id, message });

    if (error) return NextResponse.json({ error: friendlyError(error) }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: friendlyError(error) }, { status: 500 });
  }
}
