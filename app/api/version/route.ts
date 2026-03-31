import { NextResponse } from 'next/server';

import { getLatestAppVersion } from '@/lib/app-version';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  return NextResponse.json(
    { version: getLatestAppVersion() },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        Pragma: 'no-cache',
        Expires: '0'
      }
    }
  );
}
