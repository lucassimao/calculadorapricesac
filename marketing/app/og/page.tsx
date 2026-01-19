import type { Metadata } from 'next';
import Image from 'next/image';
import styles from './og.module.css';

export const metadata: Metadata = {
  title: 'Prévia de OG',
  description: 'Prévia dos assets de Open Graph e Twitter Cards.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function OgPreviewPage() {
  return (
    <main className={styles.page}>
      <div>
        <h1 className={styles.title}>Prévia de Open Graph</h1>
        <p className={styles.lead}>
          Esta página ajuda a validar os assets de compartilhamento. Use os links abaixo para checar
          OG/Twitter em validadores externos.
        </p>
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <Image src="/opengraph-image" alt="Open Graph 1200x630" width={1200} height={630} />
          <div className={styles.meta}>
            <div>Open Graph 1200×630</div>
            <div className={styles.code}>/opengraph-image</div>
          </div>
        </div>
        <div className={styles.card}>
          <Image src="/twitter-image" alt="Twitter Card 1200x630" width={1200} height={630} />
          <div className={styles.meta}>
            <div>Twitter Card 1200×630</div>
            <div className={styles.code}>/twitter-image</div>
          </div>
        </div>
        <div className={styles.card}>
          <Image src="/og-square" alt="Open Graph 1200x1200" width={1200} height={1200} />
          <div className={styles.meta}>
            <div>Open Graph 1200×1200</div>
            <div className={styles.code}>/og-square</div>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.meta}>
          <div>Validadores recomendados:</div>
          <ul>
            <li>LinkedIn Post Inspector</li>
            <li>X/Twitter Card Validator</li>
            <li>Facebook Sharing Debugger</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
