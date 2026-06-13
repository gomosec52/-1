import { NextResponse } from 'next/server';
import { configuredBackgroundVideoUrl } from '@/lib/serverBackgroundVideo';

export async function GET() {
  return NextResponse.json({
    backgroundVideoUrl: configuredBackgroundVideoUrl()
  });
}
