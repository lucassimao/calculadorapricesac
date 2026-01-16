import type { Metadata } from "next";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Suporte",
  description: "Suporte e contato da Calculadora Price & SAC.",
  alternates: {
    canonical: "/suporte",
  },
  openGraph: {
    title: "Suporte",
    description: "Suporte e contato da Calculadora Price & SAC.",
    url: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://calculadorapricesac.com"}/suporte`,
  },
};

export default function SupportPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Preciso de login para usar o app?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Não. O app funciona offline e sem cadastro.",
        },
      },
      {
        "@type": "Question",
        name: "Como funciona o Premium?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "É uma compra única que remove anúncios e libera exportações em PDF, XLSX e CSV.",
        },
      },
      {
        "@type": "Question",
        name: "Consigo restaurar a compra em outro dispositivo?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Sim. Há um botão de restaurar na aba Premium do aplicativo.",
        },
      },
      {
        "@type": "Question",
        name: "Onde ficam meus dados salvos?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Salvos localmente no dispositivo. O app não envia dados para servidores externos.",
        },
      },
    ],
  };

  return (
    <main className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <div>
        <h1 className={styles.title}>Suporte</h1>
        <p className={styles.lead}>
          Precisa de ajuda com a Calculadora Price &amp; SAC? Respondo rapidamente por e-mail.
        </p>
      </div>

      <section className={styles.section}>
        <h2>Contato</h2>
        <p>
          E-mail:{" "}
          <a className={styles.link} href="mailto:lucas@lucassimao.com">
            lucas@lucassimao.com
          </a>
        </p>
        <p>Tempo médio de resposta: até 48 horas úteis.</p>
      </section>

      <section className={styles.section}>
        <h2>Dúvidas frequentes</h2>
        <ul className={styles.list}>
          <li>
            <strong>Preciso de login?</strong> Não. O app funciona offline e sem cadastro.
          </li>
          <li>
            <strong>Como funciona o Premium?</strong> É uma compra única que remove anúncios e libera
            exportações em PDF, XLSX e CSV.
          </li>
          <li>
            <strong>Consigo restaurar a compra?</strong> Sim. Há um botão de restaurar na aba Premium.
          </li>
          <li>
            <strong>Onde ficam meus dados?</strong> Salvos localmente no dispositivo.
          </li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>Relatar problemas</h2>
        <p>
          Para agilizar, informe o modelo do aparelho, a versão do sistema (iOS ou Android) e o
          que estava fazendo no momento do erro.
        </p>
      </section>
    </main>
  );
}
