import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'StockPilot Lite',
  description: 'Simple inventory management for cabinet shops'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
