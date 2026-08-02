import { ImageResponse } from 'next/og';

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

export default function TwitterImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '80px',
        background: 'linear-gradient(135deg, #f6f4f0 0%, #efe6d9 100%)',
        color: '#1a1d1b',
        fontFamily: 'serif',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '60%' }}>
        <div style={{ fontSize: 24, textTransform: 'uppercase', letterSpacing: '0.2em' }}>
          Calculadora Price & SAC
        </div>
        <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.05 }}>
          Simule financiamento imobiliário com SAC e Price.
        </div>
        <div style={{ fontSize: 28, color: '#4a4f4b' }}>
          Funciona offline • tabela completa • FGTS • exportações Premium
        </div>
      </div>
      <div
        style={{
          width: 300,
          height: 300,
          borderRadius: 80,
          background: 'linear-gradient(135deg, #2c544a, #5f8b7e)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: 56,
          fontWeight: 700,
        }}
      >
        SAC
      </div>
    </div>,
    size,
  );
}
