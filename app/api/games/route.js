import { NextResponse } from 'next/server';
import { getGamesForPack } from '@/lib/data';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const pack = searchParams.get('pack') || 1;
  const games = await getGamesForPack(pack);
  return NextResponse.json({ games });
}
