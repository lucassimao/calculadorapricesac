import type { Config, CopyEntry, SlotConfig, StoreConfig } from './types.js';

export function buildCoverPrompt(
  cfg: Config,
  creative: number,
  store: string,
  storeCfg: StoreConfig,
  slot: SlotConfig,
  copy: CopyEntry
) {
  const keywords = slot.keywords?.join(', ') ?? '';
  const textSide = Math.round(cfg.layout.textSidePct * 100);
  const textHeight = Math.round(cfg.layout.textBackdropHeightPct * 100);
  const textBounds = calcTextBounds(cfg);
  const creativeBlock = creativeGuidance(creative);
  const storeSafe =
    store === 'appstore'
      ? '- Área segura App Store: deixe espaço livre acima do título; topo do título abaixo de 200px.'
      : '';
  const frameGuidance =
    store === 'appstore'
      ? '- Enquadre a captura dentro de um frame de iPhone (estilo iOS), com bordas finas e cantos arredondados.'
      : '- Enquadre a captura dentro de um frame de Android (estilo Pixel), com bordas finas e cantos arredondados.';

  return `
Crie um banner vertical para ${store} com 1024x1536.
- Use a captura de tela enviada como UI do app e mantenha-a intacta.
- Use a segunda imagem apenas como guia de layout.

Texto (renderizar exatamente):
Título: "${copy.headline}"
Subtítulo: "${copy.subhead}"

Tipografia:
- Título grande e bold; subtítulo menor e legível.
- Texto dentro do topo ${textHeight}% do canvas, com margem lateral ${textSide}%.
- Caixa de texto (1024x1536): left=${textBounds.left}, right=${textBounds.right}, top=${textBounds.top}, bottom=${textBounds.bottom}.
- Sem logos ou textos extras.
${storeSafe}

Layout:
- Mantenha a captura de tela centralizada na área inferior.
- A captura deve aparecer dentro do frame do dispositivo solicitado (não use imagens reais de aparelhos).
- O conteúdo da captura deve permanecer intacto; não altere textos/cores da UI.
- Fundo limpo, alto contraste e sem ruído próximo ao texto.
${keywords ? `- Temas: ${keywords}.` : ''}
${creativeBlock}
${frameGuidance}

Saída final será redimensionada para ${storeCfg.width}x${storeCfg.height}.
  `.trim();
}

export function buildBannerPrompt() {
  return `
Crie um banner horizontal promocional (1280x720).
- Gere o texto livremente (headline + subhead) em PT-BR.
- Texto deve destacar: calculadora de financiamento Price e SAC, comparativo, clareza, exportação.
- Tom moderno, direto e confiável.
- Título em destaque; subtítulo menor.
- Alto contraste e fundo limpo.
- Não use marcas registradas ou logos conhecidos.
  `.trim();
}

export function buildIconPrompt(appName: string, store: 'appstore' | 'play') {
  const storeGuidance =
    store === 'appstore'
      ? `
- Ícone da App Store: 1024x1024 PNG, sem transparência (sem alpha).
- Não aplique cantos arredondados; o sistema aplica a máscara.
- Sem sombras externas.
      `
      : `
- Ícone do Google Play: 512x512 PNG, quadrado cheio.
- Sem transparência e sem sombras; o Play aplica máscara e sombra.
      `;

  return `
Crie um ícone de app minimalista e moderno (${store === 'appstore' ? '1024x1024' : '512x512'}).
- Estilo limpo, alto contraste, sem texto nem números.
- Formas simples, bem definidas e fáceis de reconhecer em tamanhos pequenos.
- Inspiração: finanças, gráficos, cálculo, planejamento.
- Fundo sólido ou gradiente suave.
- Não use marcas registradas ou logos conhecidos.
- Mantenha o símbolo principal centralizado e com margem interna de pelo menos 15% em todos os lados
  para ficar seguro em máscaras de ambas as lojas.
${storeGuidance}

App: "${appName}"
  `.trim();
}

function creativeGuidance(level: number) {
  const clamped = Math.max(0, Math.min(5, level));
  switch (clamped) {
    case 0:
      return '- Criatividade: conservadora, composição simples.';
    case 1:
      return '- Criatividade: leve, com gradientes sutis.';
    case 2:
      return '- Criatividade: moderada, com profundidade e formas suaves.';
    case 3:
      return '- Criatividade: ousada, cores marcantes e elementos geométricos.';
    case 4:
      return '- Criatividade: alta, efeitos expressivos mantendo legibilidade.';
    case 5:
      return '- Criatividade: máxima, visual cinematográfico sem sacrificar clareza.';
    default:
      return '';
  }
}

function calcTextBounds(cfg: Config) {
  const width = cfg.defaults.baseWidth;
  const height = cfg.defaults.baseHeight;
  const left = Math.round(width * cfg.layout.textSidePct);
  const right = Math.round(width * (1 - cfg.layout.textSidePct));
  const top = Math.round(height * cfg.layout.textTopPct);
  const bottom = Math.min(height, Math.round(height * (cfg.layout.textTopPct + cfg.layout.textBackdropHeightPct)));
  return { left, right, top, bottom };
}
