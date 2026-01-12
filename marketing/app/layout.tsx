import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Fraunces, Manrope } from "next/font/google";
import "./globals.css";
import styles from "./site.module.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://calculadorapricesac.com"),
  title: {
    default: "Calculadora Price & SAC",
    template: "%s · Calculadora Price & SAC",
  },
  description:
    "Simulador de financiamento imobiliário SAC e Price. 100% offline, com tabela completa, FGTS, custos e comparativo.",
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
                <Link href="/suporte">Suporte</Link>
              </nav>
            </div>
          </header>
          <div className={styles.main}>{children}</div>
          <footer className={styles.footer}>
            <div className={styles.footerInner}>
              <div>© 2026 Calculadora Price &amp; SAC. Todos os direitos reservados.</div>
              <div className={styles.footerLinks}>
                <Link href="/privacidade">Política de Privacidade</Link>
                <Link href="/suporte">Suporte</Link>
                <a href="mailto:lucas@lucassimao.com">lucas@lucassimao.com</a>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
