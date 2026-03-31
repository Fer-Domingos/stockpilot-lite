import { NextResponse } from 'next/server';

import { getLatestAppVersion } from '@/lib/app-version';

export async function GET() {
  return NextResponse.json(
    { version: getLatestAppVersion() },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
      }
    }
  );
}
