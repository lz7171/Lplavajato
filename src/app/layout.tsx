import type { Metadata, Viewport } from 'next';
import { BUSINESS } from '@/lib/config';
import { siteUrl } from '@/lib/env';
import { body, display } from './fonts';
import './globals.css';

export function generateMetadata(): Metadata {
  return {
    metadataBase: new URL(siteUrl()),
    title: {
      default: `${BUSINESS.name} — Barbearia | Corte, luzes e platinado`,
      template: `%s · ${BUSINESS.name}`,
    },
    description:
      'Jef Barber: corte disfarçado, cabelo e barba, luzes e platinado. Especialista em cabelo liso. Chame o Jef pelo WhatsApp.',
    applicationName: BUSINESS.name,
    formatDetection: { telephone: false, email: false, address: false },
    openGraph: {
      type: 'website',
      locale: 'pt_BR',
      siteName: BUSINESS.name,
      title: `${BUSINESS.name} — Barbearia`,
      description: 'Corte, cabelo e barba, luzes e platinado. Chame no WhatsApp.',
    },
    twitter: { card: 'summary_large_image' },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0e0e10',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
