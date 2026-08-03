export interface ResourceScreenshot {
  src: string;
  alt: string;
}

export interface ResourceFaq {
  q: string;
  a: string;
}

export interface Resource {
  slug: string;
  title: string;
  metaTitle: string;
  description: string;
  hook: string;
  guideSlug: string;
  steps: string[];
  screenshots: ResourceScreenshot[];
  faq: ResourceFaq[];
  related: string[];
}

const shot = (slug: string, file: string, alt: string): ResourceScreenshot => ({
  src: `/recursos/${slug}/${file}.webp`,
  alt,
});

export const resources: Resource[] = [
  {
    slug: 'simulador-sac-ou-price',
    title: 'Simulador SAC ou Price: compare as parcelas',
    metaTitle: 'Simulador SAC ou Price: compare parcelas e juros',
    description:
      'Compare SAC e Price lado a lado: primeira parcela, total de juros, CET e evolução do saldo no simulador de financiamento.',
    hook: 'Veja em poucos minutos qual sistema cabe melhor no seu orçamento.',
    guideSlug: 'sac-ou-price',
    steps: [
      'Abra o simulador e preencha valor do imóvel, entrada, taxa e prazo no bloco de parâmetros.',
      'Confira as duas telas de resumo: SAC mostra parcela decrescente e Price mostra parcela fixa.',
      'Compare primeira parcela, total de juros e CET nos cartões lado a lado.',
      'Desça até os gráficos para visualizar saldo e composição das parcelas ao longo do tempo.',
    ],
    screenshots: [
      shot('simulador-sac-ou-price', 'resumo', 'Resumo do app com os valores do financiamento.'),
      shot('simulador-sac-ou-price', 'graficos', 'Gráficos do app comparando saldo e parcelas.'),
    ],
    faq: [
      {
        q: 'Qual sistema começa com a menor parcela?',
        a: 'Para o mesmo valor, taxa e prazo, a Price normalmente começa com a menor parcela; o SAC tende a pagar menos juros no total.',
      },
      {
        q: 'O simulador mostra o CET?',
        a: 'Sim. O resumo apresenta o CET calculado para o cenário e separa o resultado de cada sistema.',
      },
    ],
    related: ['amortizacao-reduzir-prazo-ou-parcela', 'renda-para-financiar-imovel'],
  },
  {
    slug: 'amortizacao-reduzir-prazo-ou-parcela',
    title: 'Simulador de amortização: reduzir prazo ou parcela',
    metaTitle: 'Amortização: reduzir prazo ou parcela no financiamento',
    description:
      'Simule uma amortização extra e veja quanto economiza de juros ao reduzir o prazo ou aliviar o valor da parcela.',
    hook: 'Coloque um valor extra no contrato e veja o efeito antes de decidir.',
    guideSlug: 'amortizar-prazo-ou-parcela',
    steps: [
      'Preencha o contrato e role até Amortizações Extras na tela da calculadora.',
      'Informe data, valor e escolha reduzir prazo ou reduzir parcela.',
      'Toque em adicionar para incluir o evento no cronograma e conferir a nova simulação.',
      'Compare o resumo e a tabela para ver juros economizados, prazo e saldo depois da amortização.',
    ],
    screenshots: [
      shot(
        'amortizacao-reduzir-prazo-ou-parcela',
        'resumo',
        'Resumo do financiamento após a simulação.',
      ),
      shot(
        'amortizacao-reduzir-prazo-ou-parcela',
        'tabela',
        'Tabela de amortização com parcelas e saldo devedor.',
      ),
    ],
    faq: [
      {
        q: 'Reduzir prazo economiza mais juros?',
        a: 'Em geral, sim: você encerra o contrato antes e deixa de pagar juros por mais meses.',
      },
      {
        q: 'Posso programar amortizações recorrentes?',
        a: 'Sim. No app, a série pode ser mensal, anual ou a cada 2 anos e cada evento continua editável.',
      },
    ],
    related: ['quitar-financiamento-antecipado', 'salvar-e-comparar-cenarios'],
  },
  {
    slug: 'fgts-no-financiamento-simulador',
    title: 'Simulador de FGTS no financiamento imobiliário',
    metaTitle: 'Simulador de FGTS no financiamento imobiliário',
    description:
      'Simule FGTS na entrada, na amortização ou no abatimento de parcelas e veja como muda o custo do financiamento.',
    hook: 'Escolha a finalidade correta e compare o impacto do FGTS no seu contrato.',
    guideSlug: 'fgts-no-financiamento',
    steps: [
      'Role até a seção FGTS e informe o valor que pretende usar.',
      'Escolha a finalidade: entrada, amortização do saldo ou pagamento de prestações.',
      'Para amortização, selecione reduzir prazo ou reduzir parcela e confira a regra exibida.',
      'Adicione o evento e leia o resumo e a tabela com o novo saldo devedor.',
    ],
    screenshots: [
      shot(
        'fgts-no-financiamento-simulador',
        'resumo',
        'Resumo do app com o custo total e a primeira parcela.',
      ),
      shot(
        'fgts-no-financiamento-simulador',
        'tabela',
        'Tabela do app para acompanhar saldo após o FGTS.',
      ),
    ],
    faq: [
      {
        q: 'O FGTS para parcelas usa a mesma recorrência da amortização?',
        a: 'Não. O pagamento de prestações pode cobrir até 80% de 12 parcelas consecutivas; amortização ou liquidação segue o intervalo de 2 anos.',
      },
      {
        q: 'O app substitui a conferência com o banco?',
        a: 'Não. A simulação ajuda na decisão, mas a instituição deve confirmar enquadramento, saldo e documentação.',
      },
    ],
    related: ['amortizacao-reduzir-prazo-ou-parcela', 'quitar-financiamento-antecipado'],
  },
  {
    slug: 'cet-custo-real-financiamento',
    title: 'CET do financiamento: veja o custo real com taxas',
    metaTitle: 'CET do financiamento: simule o custo real',
    description:
      'Inclua IOF, seguros e tarifas na simulação e entenda como o CET muda o custo efetivo do financiamento.',
    hook: 'A taxa anunciada é só o começo: compare o custo efetivo total.',
    guideSlug: 'o-que-e-cet',
    steps: [
      'Preencha o valor financiado, taxa, prazo e sistema de amortização.',
      'Adicione custos opcionais, como IOF, seguro e tarifa administrativa, quando existirem na proposta.',
      'Leia o CET no resumo do SAC e do Price e compare com a taxa nominal.',
      'Use a tabela para conferir como juros e custos aparecem ao longo do cronograma.',
    ],
    screenshots: [
      shot(
        'cet-custo-real-financiamento',
        'resumo',
        'Resumo do app com juros, total pago e primeira parcela.',
      ),
      shot(
        'cet-custo-real-financiamento',
        'tabela',
        'Tabela de amortização usada para conferir o custo.',
      ),
    ],
    faq: [
      {
        q: 'CET e taxa de juros são a mesma coisa?',
        a: 'Não. O CET reúne juros e custos do contrato em uma taxa anual para facilitar a comparação entre propostas.',
      },
      {
        q: 'O app promete reproduzir qualquer proposta bancária?',
        a: 'Não. A conferência validada cobre crédito prefixado em SAC e Price sem seguros individualizados; confira sempre a proposta do banco.',
      },
    ],
    related: ['simulador-sac-ou-price', 'juros-totais-financiamento-30-anos'],
  },
  {
    slug: 'financiamento-tr-ou-ipca',
    title: 'Financiamento TR ou IPCA: veja a correção no saldo',
    metaTitle: 'Financiamento TR ou IPCA: simule a correção',
    description:
      'Simule financiamento indexado por TR ou IPCA e acompanhe a correção monetária no resumo e na tabela.',
    hook: 'Não olhe só para a parcela: veja o indexador agindo sobre o saldo.',
    guideSlug: 'o-que-e-cet',
    steps: [
      'Informe sistema, valor, taxa e prazo na calculadora.',
      'Selecione TR ou IPCA na seção de indexador e confira a taxa aplicada.',
      'Leia o total de correção no resumo antes de comparar propostas.',
      'Role até a tabela e observe a coluna de correção em cada parcela.',
    ],
    screenshots: [
      shot('financiamento-tr-ou-ipca', 'tabela', 'Tabela do app com parcelas e saldo devedor.'),
      shot(
        'financiamento-tr-ou-ipca',
        'graficos',
        'Gráficos do app para acompanhar a evolução do saldo.',
      ),
    ],
    faq: [
      {
        q: 'IPCA pode fazer o saldo subir?',
        a: 'Sim. Quando a correção acumulada supera a amortização do período, o saldo pode cair mais devagar ou até aumentar.',
      },
      {
        q: 'A taxa do app é uma promessa para o contrato?',
        a: 'Não. A taxa de referência é uma entrada de simulação; use a proposta e os índices efetivos do banco para a decisão final.',
      },
    ],
    related: ['parcela-subiu-saldo-devedor-nao-diminui', 'simulador-sac-ou-price'],
  },
  {
    slug: 'exportar-simulacao-pdf-excel',
    title: 'Como exportar uma simulação em PDF, Excel ou CSV',
    metaTitle: 'Exportar simulação de financiamento em PDF, Excel e CSV',
    description:
      'Veja como exportar a tabela do financiamento em PDF, XLSX ou CSV e compartilhar os números da simulação.',
    hook: 'Leve a tabela completa para uma reunião, planilha ou proposta profissional.',
    guideSlug: 'o-que-e-cet',
    steps: [
      'Finalize o cenário e role até a seção da tabela de amortização.',
      'Toque em PDF, XLSX ou CSV no bloco Gerar tabela completa.',
      'Escolha a opção profissional quando precisar incluir a marca do corretor.',
      'Compartilhe o arquivo gerado pelo menu nativo do aparelho.',
    ],
    screenshots: [
      shot(
        'exportar-simulacao-pdf-excel',
        'tabela',
        'Tabela completa do app com opções PDF, XLSX e CSV.',
      ),
      shot(
        'exportar-simulacao-pdf-excel',
        'resumo',
        'Resumo do app antes de exportar a simulação.',
      ),
    ],
    faq: [
      {
        q: 'Quais formatos estão disponíveis?',
        a: 'A exportação oferece PDF, XLSX e CSV; recursos profissionais podem exigir Premium.',
      },
      {
        q: 'Posso incluir dados de clientes?',
        a: 'Use apenas dados autorizados. O app não deve receber nomes ou informações de terceiros sem necessidade.',
      },
    ],
    related: ['salvar-e-comparar-cenarios', 'cet-custo-real-financiamento'],
  },
  {
    slug: 'salvar-e-comparar-cenarios',
    title: 'Salvar e comparar cenários de financiamento',
    metaTitle: 'Salvar e comparar cenários de financiamento',
    description:
      'Salve simulações e compare condições de financiamento para decidir entre taxas, prazos e sistemas SAC ou Price.',
    hook: 'Guarde propostas diferentes e compare os números sem refazer tudo.',
    guideSlug: 'sac-ou-price',
    steps: [
      'Preencha um cenário e dê um nome que identifique a proposta.',
      'Salve o cenário depois de conferir resumo, CET e tabela.',
      'Abra a aba Comparar para colocar condições lado a lado.',
      'Use a diferença de parcela, juros e total pago para orientar a escolha.',
    ],
    screenshots: [
      shot('salvar-e-comparar-cenarios', 'resumo', 'Resumo do cenário salvo no app.'),
      shot(
        'salvar-e-comparar-cenarios',
        'graficos',
        'Gráficos usados para comparar a evolução dos cenários.',
      ),
    ],
    faq: [
      {
        q: 'Quantos cenários posso salvar?',
        a: 'O limite depende do estado da conta; o Premium libera cenários ilimitados conforme a oferta do app.',
      },
      {
        q: 'Comparar cenários muda os contratos?',
        a: 'Não. A comparação é apenas uma análise local das simulações salvas.',
      },
    ],
    related: ['simulador-sac-ou-price', 'exportar-simulacao-pdf-excel'],
  },
  {
    slug: 'quitar-financiamento-antecipado',
    title: 'Quitar o financiamento antecipado: quanto você economiza?',
    metaTitle: 'Quitar financiamento antecipado: simule a economia',
    description:
      'Simule a quitação antecipada do financiamento e compare juros economizados e total pago com o contrato original.',
    hook: 'Descubra o custo de quitar agora antes de tomar a decisão.',
    guideSlug: 'amortizar-prazo-ou-parcela',
    steps: [
      'Informe o saldo e as condições do financiamento que você quer encerrar.',
      'Adicione uma amortização extraordinária com o valor necessário para quitar o saldo.',
      'Confira o resumo antes e depois: prazo restante, juros e total pago.',
      'Use a tabela para localizar a parcela em que o saldo chega a zero.',
    ],
    screenshots: [
      shot(
        'quitar-financiamento-antecipado',
        'resumo',
        'Resumo do financiamento com total pago e juros.',
      ),
      shot(
        'quitar-financiamento-antecipado',
        'tabela',
        'Tabela de amortização para acompanhar a quitação.',
      ),
    ],
    faq: [
      {
        q: 'Quitar sempre economiza juros?',
        a: 'Ao eliminar parcelas futuras, a quitação tende a eliminar juros futuros; confirme saldo para quitação e eventuais custos com o banco.',
      },
      {
        q: 'Quitar é igual a amortizar?',
        a: 'Quitar encerra o saldo de uma vez; amortizar pode ser parcial e manter o contrato com prazo ou parcela ajustados.',
      },
    ],
    related: ['amortizacao-reduzir-prazo-ou-parcela', 'cet-custo-real-financiamento'],
  },
  {
    slug: 'parcela-subiu-saldo-devedor-nao-diminui',
    title: 'Por que a parcela subiu e o saldo devedor não diminui?',
    metaTitle: 'Parcela subiu e saldo devedor não diminui: entenda',
    description:
      'Entenda como TR e IPCA corrigem o saldo devedor e veja na tabela do simulador onde essa correção aparece.',
    hook: 'Diagnostique a correção monetária olhando linha por linha.',
    guideSlug: 'o-que-e-cet',
    steps: [
      'Monte um cenário com o sistema, taxa e prazo do contrato.',
      'Selecione o indexador usado na proposta e informe uma taxa de referência.',
      'Leia o total de correção no resumo para dimensionar o efeito acumulado.',
      'Na tabela, compare correção, juros, amortização e saldo em cada linha.',
    ],
    screenshots: [
      shot(
        'parcela-subiu-saldo-devedor-nao-diminui',
        'tabela',
        'Tabela do app com saldo e parcelas do financiamento.',
      ),
      shot(
        'parcela-subiu-saldo-devedor-nao-diminui',
        'graficos',
        'Gráfico do app mostrando a evolução do saldo.',
      ),
    ],
    faq: [
      {
        q: 'A parcela subir significa erro na amortização?',
        a: 'Não necessariamente. A correção do indexador pode aumentar o saldo ou a prestação mesmo quando existe amortização.',
      },
      {
        q: 'O simulador calcula o índice futuro?',
        a: 'Ele simula a partir da taxa informada ou de uma referência disponível; o contrato real depende do índice efetivo.',
      },
    ],
    related: ['financiamento-tr-ou-ipca', 'cet-custo-real-financiamento'],
  },
  {
    slug: 'renda-para-financiar-imovel',
    title: 'Quanto preciso ganhar para financiar um imóvel?',
    metaTitle: 'Renda para financiar imóvel: calcule pela parcela',
    description:
      'Simule a primeira parcela de um imóvel e estime a renda mínima usando a referência de comprometimento de 30%.',
    hook: 'Troque o valor do imóvel pela parcela e tenha uma referência de renda.',
    guideSlug: 'entrada-financiamento',
    steps: [
      'Informe valor do imóvel, entrada, taxa e prazo na calculadora.',
      'Leia a primeira parcela no resumo do SAC e a parcela da Price.',
      'Divida a parcela de referência por 0,30 para obter uma estimativa de renda mínima.',
      'Teste outra entrada ou prazo e compare como a renda estimada muda.',
    ],
    screenshots: [
      shot(
        'renda-para-financiar-imovel',
        'resumo',
        'Resumo do app com a primeira parcela do financiamento.',
      ),
      shot(
        'renda-para-financiar-imovel',
        'graficos',
        'Gráficos do app para entender o custo ao longo do prazo.',
      ),
    ],
    faq: [
      {
        q: 'A regra de 30% garante aprovação?',
        a: 'Não. É uma referência de comprometimento de renda; o banco também avalia perfil, dívidas, entrada e documentação.',
      },
      {
        q: 'Uso a parcela do SAC ou da Price?',
        a: 'Use a parcela inicial que corresponde ao sistema escolhido e compare os dois se ainda estiver decidindo.',
      },
    ],
    related: ['simulador-sac-ou-price', 'juros-totais-financiamento-30-anos'],
  },
  {
    slug: 'financiamento-de-veiculo-tabela-price',
    title: 'Financiamento de veículo: simule as parcelas na Price',
    metaTitle: 'Financiamento de veículo na Tabela Price: simule',
    description:
      'Use o simulador de financiamento na Tabela Price para estimar parcelas, juros e total pago em um veículo.',
    hook: 'A mesma lógica de parcelas fixas também ajuda a analisar um carro.',
    guideSlug: 'tabela-price',
    steps: [
      'Escolha o modo de financiamento padrão e informe o valor que será financiado.',
      'Preencha taxa mensal ou anual e o prazo em meses, como 48 parcelas.',
      'Leia o valor da parcela, total pago e total de juros no resultado.',
      'Compare com outra taxa ou entrada para entender o custo da proposta do veículo.',
    ],
    screenshots: [
      shot(
        'financiamento-de-veiculo-tabela-price',
        'resumo',
        'Resumo do app com parcela e total pago.',
      ),
      shot(
        'financiamento-de-veiculo-tabela-price',
        'tabela',
        'Tabela do app com as parcelas do financiamento.',
      ),
    ],
    faq: [
      {
        q: 'O app é só para imóveis?',
        a: 'Não. O modo padrão calcula empréstimos com a mesma matemática de parcelas; adapte os custos ao contrato do veículo.',
      },
      {
        q: 'A parcela da Price fica fixa?',
        a: 'A parcela matemática fica fixa sem indexador; seguros, tarifas e correções do contrato podem alterar o boleto real.',
      },
    ],
    related: ['simulador-sac-ou-price', 'juros-totais-financiamento-30-anos'],
  },
  {
    slug: 'juros-totais-financiamento-30-anos',
    title: 'Financiamento em 30 anos: quanto você paga de juros no total?',
    metaTitle: 'Financiamento em 30 anos: calcule os juros totais',
    description:
      'Compare 20 e 30 anos de financiamento e veja como o prazo altera juros totais, parcela e total pago.',
    hook: 'O prazo menor pesa na parcela, mas pode mudar radicalmente o total de juros.',
    guideSlug: 'entrada-financiamento',
    steps: [
      'Simule o mesmo valor de imóvel com prazo de 240 meses.',
      'Anote parcela, total pago e total de juros no resumo.',
      'Troque o prazo para 360 meses e compare os mesmos cartões.',
      'Use a tabela e os gráficos para explicar de onde vem a diferença.',
    ],
    screenshots: [
      shot(
        'juros-totais-financiamento-30-anos',
        'resumo',
        'Resumo do app com total pago e total de juros.',
      ),
      shot(
        'juros-totais-financiamento-30-anos',
        'graficos',
        'Gráficos do app para visualizar o efeito do prazo.',
      ),
    ],
    faq: [
      {
        q: '30 anos sempre é uma má escolha?',
        a: 'Não. Um prazo maior pode caber melhor no orçamento; o ponto é conhecer o custo total e avaliar amortizações futuras.',
      },
      {
        q: 'Como reduzir o total de juros?',
        a: 'Entrada maior, prazo menor e amortizações antecipadas tendem a reduzir juros, cada um com impacto diferente no caixa.',
      },
    ],
    related: ['renda-para-financiar-imovel', 'amortizacao-reduzir-prazo-ou-parcela'],
  },
];

export const resourceBySlug = (slug: string): Resource | undefined =>
  resources.find((resource) => resource.slug === slug);
