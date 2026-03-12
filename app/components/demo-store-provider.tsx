'use client';

import { DemoStoreProvider as Provider } from '@/lib/demo-store';

export function DemoStoreProvider({ children }: { children: React.ReactNode }) {
  return <Provider>{children}</Provider>;
}
