import { NextResponse } from 'next/server';
import { getAppVersion } from '@/lib/app-version';

export async function GET() {
  return NextResponse.json(
    { version: getAppVersion() },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
      }
    }
  );
}
