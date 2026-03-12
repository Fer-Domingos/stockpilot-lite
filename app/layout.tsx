import './globals.css';
import type { Metadata } from 'next';
import { DemoStoreProvider } from '@/app/components/demo-store-provider';

export const metadata: Metadata = {
  title: 'StockPilot Lite',
  description: 'Simple inventory management for cabinet shops'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <DemoStoreProvider>{children}</DemoStoreProvider>
      </body>
    </html>
  );
}
