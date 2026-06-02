// Editorial guides (SEO content). Single source for the /guias index, the
// /guias/[slug] pages, their structured data, and the sitemap.

export type Block =
  | { type: 'p'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'table'; head: string[]; rows: string[][] }
  | { type: 'callout'; text: string };

export interface Section {
  heading: string;
  blocks: Block[];
}

export interface Faq {
  q: string;
  a: string;
}

export interface Guide {
  slug: string;
  /** H1 + structured-data headline */
  title: string;
  /** <title> tag */
  metaTitle: string;
  description: string;
  /** ISO date, used for datePublished/dateModified */
  updated: string;
  /** Short hook shown in the index card */
  hook: string;
  /** Lead paragraph under the H1 */
  intro: string;
  sections: Section[];
  faq: Faq[];
  related: string[];
}

const UPDATED = '2026-06-02';

export const guides: Guide[] = [
  {
    slug: 'sac-ou-price',
    title: 'SAC ou Price: qual a diferença e qual escolher',
    metaTitle: 'SAC ou Price: diferença e qual escolher no financiamento',
    description:
      'Entenda a diferença entre os sistemas SAC e Price no financiamento imobiliário: como variam as parcelas, qual paga menos juros e como decidir.',
    updated: UPDATED,
    hook: 'Parcela decrescente x parcela fixa — e qual paga menos juros no total.',
    intro:
      'SAC e Price são os dois sistemas de amortização usados no financiamento imobiliário brasileiro. A diferença está em como a parcela evolui ao longo do tempo e em quanto de juros você paga no total. Veja como cada um funciona e como escolher.',
    sections: [
      {
        heading: 'Como funciona o SAC',
        blocks: [
          {
            type: 'p',
            text: 'No SAC (Sistema de Amortização Constante), a parte que abate o saldo devedor é igual em todas as parcelas. Como os juros incidem sobre um saldo que diminui mês a mês, a parcela começa mais alta e cai ao longo do financiamento.',
          },
          {
            type: 'p',
            text: 'Resultado: a primeira parcela é mais pesada, mas o total de juros pago é menor do que no Price, porque o saldo devedor cai mais rápido.',
          },
        ],
      },
      {
        heading: 'Como funciona o Price',
        blocks: [
          {
            type: 'p',
            text: 'Na Tabela Price, a parcela é fixa do começo ao fim (sem considerar correção do índice). No início, a maior parte da parcela é juros e uma fatia pequena amortiza o saldo; com o tempo, essa proporção se inverte.',
          },
          {
            type: 'p',
            text: 'Como o saldo devedor diminui mais devagar no começo, você paga mais juros no total — mas ganha previsibilidade, com uma parcela inicial menor.',
          },
        ],
      },
      {
        heading: 'SAC x Price lado a lado',
        blocks: [
          {
            type: 'table',
            head: ['Característica', 'SAC', 'Price'],
            rows: [
              ['Parcela ao longo do tempo', 'Decrescente', 'Fixa'],
              ['Amortização mensal', 'Constante', 'Crescente'],
              ['Primeira parcela', 'Mais alta', 'Mais baixa'],
              ['Total de juros pago', 'Menor', 'Maior'],
              ['Melhor para', 'Pagar menos juros', 'Previsibilidade no orçamento'],
            ],
          },
          {
            type: 'callout',
            text: 'A diferença real depende do valor, da taxa e do prazo. Simule os dois sistemas lado a lado para ver os números do seu caso.',
          },
        ],
      },
      {
        heading: 'Qual escolher',
        blocks: [
          {
            type: 'list',
            items: [
              'Escolha SAC se você aguenta uma parcela inicial maior e quer economizar no total de juros.',
              'Escolha Price se prefere uma parcela fixa e mais baixa no começo, mesmo pagando mais juros ao longo do tempo.',
              'Na dúvida, compare o total pago e o CET dos dois — não só o valor da primeira parcela.',
            ],
          },
        ],
      },
    ],
    faq: [
      {
        q: 'O SAC sempre paga menos juros que o Price?',
        a: 'Sim. Para o mesmo valor, taxa e prazo, o SAC amortiza o saldo devedor mais rápido, então o total de juros pago é menor do que no Price.',
      },
      {
        q: 'A parcela do SAC fica menor que a do Price em algum momento?',
        a: 'Sim. A parcela do SAC começa mais alta e decresce; em geral ela cruza e fica abaixo da parcela fixa do Price na segunda metade do financiamento.',
      },
      {
        q: 'Posso trocar de SAC para Price depois?',
        a: 'O sistema é definido no contrato. Mudar depois depende de renegociação com o banco e nem sempre é possível, por isso vale simular antes de assinar.',
      },
    ],
    related: ['tabela-price', 'amortizar-prazo-ou-parcela', 'o-que-e-cet'],
  },
  {
    slug: 'o-que-e-cet',
    title: 'O que é o CET (Custo Efetivo Total) do financiamento',
    metaTitle: 'CET: o que é o Custo Efetivo Total do financiamento',
    description:
      'O CET mostra o custo real do financiamento, incluindo juros, seguros e tarifas. Entenda por que ele é mais importante que a taxa de juros anunciada.',
    updated: UPDATED,
    hook: 'A taxa anunciada não é o custo real. O CET é.',
    intro:
      'O CET (Custo Efetivo Total) é a taxa que reúne tudo o que você paga em um financiamento — não só os juros, mas também seguros e tarifas. É o número que permite comparar propostas de forma justa.',
    sections: [
      {
        heading: 'O que entra no CET',
        blocks: [
          {
            type: 'p',
            text: 'A taxa de juros anunciada pelo banco é só uma parte do custo. O CET incorpora os demais encargos obrigatórios do contrato:',
          },
          {
            type: 'list',
            items: [
              'Juros do financiamento (a taxa nominal anunciada).',
              'Seguro MIP — cobre morte e invalidez do comprador.',
              'Seguro DFI — cobre danos físicos ao imóvel.',
              'Tarifa de administração / manutenção, quando houver.',
              'Outros encargos, como avaliação do imóvel e, em alguns casos, IOF.',
            ],
          },
          {
            type: 'callout',
            text: 'Por isso o CET é sempre maior que a taxa de juros anunciada. É ele que reflete o custo real.',
          },
        ],
      },
      {
        heading: 'Por que o CET importa na hora de comparar',
        blocks: [
          {
            type: 'p',
            text: 'Dois bancos podem anunciar a mesma taxa de juros e, ainda assim, cobrar custos finais diferentes — porque os seguros e tarifas variam. Comparar apenas a taxa nominal pode levar à proposta errada.',
          },
          {
            type: 'p',
            text: 'O CET, expresso em % ao ano, coloca todas as propostas na mesma base: quanto menor o CET, mais barato é o financiamento como um todo.',
          },
        ],
      },
      {
        heading: 'Como reduzir o CET',
        blocks: [
          {
            type: 'list',
            items: [
              'Dê uma entrada maior: financiar menos reduz juros e seguros.',
              'Compare seguros — em muitos casos é possível contratar o seguro habitacional fora do banco.',
              'Negocie a taxa e as tarifas, especialmente se você é correntista.',
              'Prefira prazos menores quando o orçamento permitir.',
            ],
          },
        ],
      },
    ],
    faq: [
      {
        q: 'CET e taxa de juros são a mesma coisa?',
        a: 'Não. A taxa de juros é só uma parte. O CET soma juros, seguros e tarifas, então mostra o custo total do financiamento e é sempre maior que a taxa anunciada.',
      },
      {
        q: 'O banco é obrigado a informar o CET?',
        a: 'Sim. Pela regulação do Banco Central, a instituição deve informar o CET antes da contratação, expresso em percentual anual.',
      },
      {
        q: 'Qual é um bom CET para financiamento imobiliário?',
        a: 'Depende do mercado e do seu perfil. O importante é comparar o CET entre propostas: o menor representa o financiamento mais barato no total.',
      },
    ],
    related: ['sac-ou-price', 'entrada-financiamento', 'fgts-no-financiamento'],
  },
  {
    slug: 'fgts-no-financiamento',
    title: 'Como usar o FGTS no financiamento imobiliário',
    metaTitle: 'FGTS no financiamento imobiliário: como usar e regras',
    description:
      'Veja como usar o FGTS no financiamento: na entrada, para amortizar o saldo devedor ou para abater parcelas — e as principais condições.',
    updated: UPDATED,
    hook: 'Entrada, amortização ou abatimento de parcelas — onde o FGTS rende mais.',
    intro:
      'O FGTS pode ser uma das ferramentas mais poderosas no financiamento da casa própria. Ele pode ser usado de três formas, cada uma com um efeito diferente no seu bolso. Veja como funciona e as condições gerais.',
    sections: [
      {
        heading: 'As três formas de usar o FGTS',
        blocks: [
          {
            type: 'list',
            items: [
              'Na entrada: compor o valor de entrada e reduzir o quanto você financia.',
              'Na amortização: abater o saldo devedor, o que reduz o prazo ou o valor das parcelas.',
              'Nas parcelas: pagar parte do valor de um conjunto de prestações por um período.',
            ],
          },
          {
            type: 'callout',
            text: 'Usar o FGTS para amortizar o saldo costuma ser a opção que mais economiza juros, porque ataca diretamente o que rende juros: o saldo devedor.',
          },
        ],
      },
      {
        heading: 'Principais condições',
        blocks: [
          {
            type: 'p',
            text: 'O uso do FGTS na casa própria segue regras específicas. As condições mais comuns são:',
          },
          {
            type: 'list',
            items: [
              'Ter tempo mínimo de trabalho sob o regime do FGTS (somando os períodos).',
              'Não ser proprietário de outro imóvel residencial no mesmo município ou região.',
              'O imóvel deve ser residencial, urbano e estar dentro dos limites do Sistema Financeiro de Habitação (SFH).',
              'Para amortizar com FGTS, costuma haver um intervalo mínimo entre uma utilização e outra.',
            ],
          },
          {
            type: 'callout',
            text: 'As regras e os limites do SFH são atualizados periodicamente. Confirme as condições vigentes com a Caixa ou com o banco antes de contar com o recurso.',
          },
        ],
      },
      {
        heading: 'Amortizar pelo FGTS: prazo ou parcela?',
        blocks: [
          {
            type: 'p',
            text: 'Ao usar o FGTS para amortizar, você normalmente escolhe entre reduzir o prazo (economiza mais juros) ou reduzir o valor das parcelas (alivia o orçamento mensal). A melhor opção depende do seu objetivo.',
          },
        ],
      },
    ],
    faq: [
      {
        q: 'Posso usar o FGTS a qualquer momento para amortizar?',
        a: 'Não a qualquer momento: para amortização há um intervalo mínimo entre utilizações. Já o uso na entrada ocorre na contratação. Confirme os prazos vigentes com o banco.',
      },
      {
        q: 'Vale mais a pena usar o FGTS na entrada ou para amortizar depois?',
        a: 'Em geral, amortizar o saldo devedor economiza mais juros ao longo do tempo. Mas usar na entrada reduz o valor financiado desde o início. Simule os dois cenários.',
      },
      {
        q: 'Quem é autônomo pode usar o FGTS?',
        a: 'O FGTS depende de saldo na conta vinculada, normalmente formada por vínculos de trabalho com carteira assinada. Sem saldo de FGTS, não há recurso a utilizar.',
      },
    ],
    related: ['entrada-financiamento', 'amortizar-prazo-ou-parcela', 'sac-ou-price'],
  },
  {
    slug: 'tabela-price',
    title: 'Tabela Price: como funciona, vantagens e desvantagens',
    metaTitle: 'Tabela Price: como funciona, vantagens e desvantagens',
    description:
      'Entenda a Tabela Price no financiamento: parcela fixa, como os juros e a amortização evoluem, e quando ela vale a pena frente ao SAC.',
    updated: UPDATED,
    hook: 'Parcela fixa, previsibilidade — e o porquê de pagar mais juros no total.',
    intro:
      'A Tabela Price é o sistema de amortização em que a parcela é fixa do início ao fim do financiamento (sem contar a correção do índice). É o oposto do SAC, que tem parcelas decrescentes. Veja como ela funciona e quando faz sentido.',
    sections: [
      {
        heading: 'Como a parcela fixa é formada',
        blocks: [
          {
            type: 'p',
            text: 'Na Price, cada parcela é a soma de duas partes: juros sobre o saldo devedor e amortização do saldo. Como a parcela total é fixa, no início ela é quase toda juros e amortiza pouco; com o tempo, a fatia de juros cai e a de amortização cresce.',
          },
          {
            type: 'p',
            text: 'É por isso que, nos primeiros anos, o saldo devedor diminui devagar — e o total de juros acaba maior do que no SAC.',
          },
        ],
      },
      {
        heading: 'Vantagens',
        blocks: [
          {
            type: 'list',
            items: [
              'Previsibilidade: a parcela é conhecida e não sobe (fora a correção do índice).',
              'Parcela inicial menor que a do SAC, o que pode facilitar a aprovação do crédito.',
              'Bom para quem prioriza estabilidade no orçamento mensal.',
            ],
          },
        ],
      },
      {
        heading: 'Desvantagens',
        blocks: [
          {
            type: 'list',
            items: [
              'Paga mais juros no total do que no SAC, para o mesmo valor e prazo.',
              'O saldo devedor cai mais devagar no começo.',
              'Amortizações extras têm efeito relevante, mas é preciso planejá-las.',
            ],
          },
          {
            type: 'callout',
            text: 'Antes de decidir, compare Price e SAC com os números do seu financiamento — o total pago costuma surpreender.',
          },
        ],
      },
    ],
    faq: [
      {
        q: 'A parcela da Tabela Price nunca muda?',
        a: 'A parte de juros e amortização é fixa. Mas, se o contrato tem correção por um índice (como TR ou IPCA), o saldo e a parcela podem ser corrigidos ao longo do tempo.',
      },
      {
        q: 'Tabela Price é melhor que SAC?',
        a: 'Não há um melhor absoluto. A Price oferece parcela fixa e menor no início; o SAC paga menos juros no total. Depende do seu objetivo e orçamento.',
      },
      {
        q: 'Vale a pena fazer amortização extra na Price?',
        a: 'Sim. Amortizações extras reduzem o saldo devedor e, com ele, os juros futuros — especialmente eficazes nos primeiros anos da Price.',
      },
    ],
    related: ['sac-ou-price', 'amortizar-prazo-ou-parcela', 'o-que-e-cet'],
  },
  {
    slug: 'amortizar-prazo-ou-parcela',
    title: 'Amortizar reduzindo prazo ou parcela: o que vale mais a pena',
    metaTitle: 'Amortizar: reduzir prazo ou parcela? O que vale mais',
    description:
      'Ao amortizar o financiamento, você pode reduzir o prazo ou o valor da parcela. Veja qual opção economiza mais juros e quando escolher cada uma.',
    updated: UPDATED,
    hook: 'Reduzir prazo economiza mais juros; reduzir parcela alivia o mês.',
    intro:
      'Quando você faz uma amortização extra — com dinheiro próprio ou FGTS — o banco oferece duas opções: reduzir o prazo do financiamento ou reduzir o valor das parcelas. A escolha muda bastante o resultado.',
    sections: [
      {
        heading: 'Reduzir o prazo',
        blocks: [
          {
            type: 'p',
            text: 'Reduzir o prazo mantém a parcela parecida, mas encurta o financiamento. Como você passa menos meses pagando juros sobre o saldo, essa é a opção que mais economiza no total.',
          },
          {
            type: 'callout',
            text: 'Se o seu objetivo é pagar o menor total de juros possível, reduzir o prazo costuma ser a melhor escolha.',
          },
        ],
      },
      {
        heading: 'Reduzir a parcela',
        blocks: [
          {
            type: 'p',
            text: 'Reduzir a parcela mantém o prazo, mas alivia o valor mensal. A economia de juros é menor que a da redução de prazo, em compensação você ganha fôlego no orçamento.',
          },
          {
            type: 'p',
            text: 'É uma boa opção quando a prioridade é diminuir o comprometimento da renda mensal, e não necessariamente quitar mais rápido.',
          },
        ],
      },
      {
        heading: 'Como decidir',
        blocks: [
          {
            type: 'list',
            items: [
              'Quer economizar o máximo de juros? Reduza o prazo.',
              'Precisa de folga no orçamento agora? Reduza a parcela.',
              'Amortizações nos primeiros anos rendem mais, porque o saldo devedor ainda é alto.',
            ],
          },
        ],
      },
    ],
    faq: [
      {
        q: 'Reduzir prazo ou parcela economiza mais juros?',
        a: 'Reduzir o prazo economiza mais, porque encurta o tempo em que os juros incidem sobre o saldo devedor. Reduzir a parcela economiza menos, mas alivia o mês.',
      },
      {
        q: 'O banco pode recusar a amortização extra?',
        a: 'Não. O pagamento antecipado é um direito do consumidor, com redução proporcional dos juros. Você escolhe entre abater prazo ou parcela.',
      },
      {
        q: 'Quando a amortização rende mais?',
        a: 'Nos primeiros anos do financiamento, quando o saldo devedor é maior e, portanto, a maior parte da parcela ainda é juros.',
      },
    ],
    related: ['sac-ou-price', 'fgts-no-financiamento', 'tabela-price'],
  },
  {
    slug: 'entrada-financiamento',
    title: 'Quanto de entrada preciso para financiar um imóvel',
    metaTitle: 'Entrada do financiamento: quanto é preciso para financiar',
    description:
      'Quanto de entrada é preciso para financiar um imóvel, por que uma entrada maior reduz o custo e como usar o FGTS para compor o valor.',
    updated: UPDATED,
    hook: 'Normalmente 20% — e quanto maior, mais barato fica o financiamento.',
    intro:
      'A entrada é o valor que você paga do próprio bolso na compra do imóvel; o restante é financiado. Quanto de entrada é preciso, e por que vale a pena dar mais? Veja os pontos principais.',
    sections: [
      {
        heading: 'Quanto costuma ser exigido',
        blocks: [
          {
            type: 'p',
            text: 'Em geral, os bancos financiam até 80% do valor do imóvel, o que significa uma entrada mínima em torno de 20%. Alguns programas e perfis permitem financiar uma fatia maior, com entrada menor — mas a regra de partida costuma ser os 20%.',
          },
        ],
      },
      {
        heading: 'Por que uma entrada maior compensa',
        blocks: [
          {
            type: 'list',
            items: [
              'Você financia menos, então paga menos juros no total.',
              'O CET tende a cair, porque seguros e encargos incidem sobre um valor financiado menor.',
              'As parcelas ficam mais leves e a aprovação do crédito, mais fácil.',
            ],
          },
          {
            type: 'callout',
            text: 'Cada real a mais de entrada é um real que deixa de render juros ao banco durante anos. É um dos ajustes que mais reduzem o custo total.',
          },
        ],
      },
      {
        heading: 'FGTS na entrada',
        blocks: [
          {
            type: 'p',
            text: 'O FGTS pode ser usado para compor a entrada, desde que atendidas as condições de uso do fundo na casa própria. Isso permite dar uma entrada maior sem comprometer todo o seu caixa.',
          },
        ],
      },
    ],
    faq: [
      {
        q: 'Dá para financiar 100% do imóvel?',
        a: 'É raro. A maioria dos bancos exige entrada (em geral a partir de 20%). Alguns programas específicos chegam a financiar mais, mas com condições próprias.',
      },
      {
        q: 'Posso usar o FGTS como entrada?',
        a: 'Sim, desde que você atenda às regras de uso do FGTS na casa própria e o imóvel se enquadre nos limites do SFH.',
      },
      {
        q: 'Entrada maior reduz os juros?',
        a: 'Sim. Com uma entrada maior você financia menos, paga menos juros no total e costuma reduzir o CET do financiamento.',
      },
    ],
    related: ['o-que-e-cet', 'fgts-no-financiamento', 'sac-ou-price'],
  },
];

export const guideBySlug = (slug: string): Guide | undefined =>
  guides.find((g) => g.slug === slug);
