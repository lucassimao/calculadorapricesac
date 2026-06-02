import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/react';
import Image from 'next/image';
import Link from 'next/link';
import Script from 'next/script';
import { Fraunces, Manrope } from 'next/font/google';
import './globals.css';
import styles from './site.module.css';
import { siteUrl } from './site-url';
const appStoreId = '6757717537';
const appStoreUrl = 'https://apps.apple.com/br/app/calculadora-sac-price/id6757717537';
const playStoreId = process.env.NEXT_PUBLIC_PLAY_STORE_ID;
const playStoreUrl = process.env.NEXT_PUBLIC_PLAY_STORE_URL;
const gadsId = process.env.NEXT_PUBLIC_GADS_ID; // e.g. "AW-XXXXXXXXX"

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Calculadora Price & SAC',
    template: '%s · Calculadora Price & SAC',
  },
  description:
    'Simulador de financiamento imobiliário SAC e Price. 100% offline, com tabela completa, FGTS, custos e comparativo.',
  keywords: [
    'calculadora',
    'financiamento',
    'imobiliário',
    'SAC',
    'Price',
    'simulador',
    'amortização',
    'juros',
    'CET',
    'FGTS',
  ],
  authors: [{ name: 'Lucas Simão Costa', url: siteUrl }],
  creator: 'Lucas Simão Costa',
  publisher: 'Calculadora Price & SAC',
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'Calculadora Price & SAC',
    description:
      'Simulador de financiamento imobiliário SAC e Price. 100% offline, com tabela completa, FGTS, custos e comparativo.',
    url: siteUrl,
    siteName: 'Calculadora Price & SAC',
    locale: 'pt_BR',
    type: 'website',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'Calculadora Price & SAC — simulador SAC e Price',
        type: 'image/png',
      },
      {
        url: '/og-square',
        width: 1200,
        height: 1200,
        alt: 'Calculadora Price & SAC — ícone do app',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Calculadora Price & SAC',
    description:
      'Simulador de financiamento imobiliário SAC e Price. 100% offline, com tabela completa, FGTS, custos e comparativo.',
    images: [
      {
        url: '/twitter-image',
        alt: 'Calculadora Price & SAC — simulador SAC e Price',
      },
    ],
  },
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
  },
  other: {
    ...(appStoreId
      ? {
          'twitter:app:id:iphone': appStoreId,
          'twitter:app:name:iphone': 'Calculadora Price & SAC',
        }
      : {}),
    ...(appStoreUrl ? { 'twitter:app:url:iphone': appStoreUrl } : {}),
    ...(playStoreId
      ? {
          'twitter:app:id:googleplay': playStoreId,
          'twitter:app:name:googleplay': 'Calculadora Price & SAC',
        }
      : {}),
    ...(playStoreUrl ? { 'twitter:app:url:googleplay': playStoreUrl } : {}),
  },
};

export const viewport: Viewport = {
  // Matches the cream header background so mobile browser chrome blends in.
  themeColor: '#f6f4f0',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${manrope.variable} ${fraunces.variable}`}>
        <div className={styles.shell}>
          <header className={styles.header}>
            <div className={styles.headerInner}>
              <Link href="/" className={styles.logo}>
                <span className={styles.logoMark}>
                  <Image src="/icon.png" alt="Ícone do app" width={34} height={34} priority />
                </span>
                <span>Calculadora Price &amp; SAC</span>
              </Link>
              <nav className={styles.nav}>
                <Link href="/">Início</Link>
                <Link href="/privacidade">Privacidade</Link>
                <Link href="/termos">Termos</Link>
                <Link href="/suporte">Suporte</Link>
              </nav>
            </div>
          </header>
          <div className={styles.main}>{children}</div>
          <footer className={styles.footer}>
            <div className={styles.footerInner}>
              <div>© 2026 Calculadora Price &amp; SAC. Todos os direitos reservados.</div>
              <div className={styles.footerLinks}>
                <Link href="/privacidade">Privacidade</Link>
                <Link href="/termos">Termos de Uso</Link>
                <Link href="/suporte">Suporte</Link>
                <a href="mailto:lucas@lucassimao.com">lucas@lucassimao.com</a>
              </div>
            </div>
          </footer>
        </div>
        {gadsId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gadsId}`}
              strategy="afterInteractive"
            />
            <Script id="gtag-init" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${gadsId}');`}
            </Script>
          </>
        )}
        <Analytics />
      </body>
    </html>
  );
}
