(function () {
  const rules = [
    {
      profession: 'Encanador / Hidráulica',
      keywords: ['vazamento','vazando','cano','torneira','registro','pia','ralo','entupido','desentupir','vaso','hidraulica','agua'],
      questions: ['Onde está o vazamento ou entupimento?','É possível fechar o registro?','Pode enviar foto e informar quando começou?']
    },
    {
      profession: 'Eletricista',
      keywords: ['chuveiro','tomada','interruptor','disjuntor','curto','fiacao','energia','lampada','luminaria','quadro eletrico'],
      questions: ['O disjuntor desarma?','Acontece ao ligar algum aparelho?','Pode enviar foto do local e do quadro?']
    },
    {
      profession: 'Pintor',
      keywords: ['pintar','pintura','tinta','parede','massa corrida','grafiato','textura','mofo','descascando','teto'],
      questions: ['Qual a medida aproximada da área?','Há mofo, trincas ou tinta descascando?','Quem fornecerá os materiais?']
    },
    {
      profession: 'Pedreiro / Reformas',
      keywords: ['muro','reboco','reforma','contrapiso','piso','azulejo','revestimento','demolir','demolicao','alvenaria','cimento','tijolo'],
      questions: ['Qual a medida aproximada?','O local está livre para execução?','Já possui material?']
    },
    {
      profession: 'Técnico de T.I.',
      keywords: ['computador','notebook','windows','impressora','wifi','internet','virus','formatar','backup','ssd','hd'],
      questions: ['Qual equipamento e modelo?','Qual erro aparece?','Existem arquivos importantes para backup?']
    },
    {
      profession: 'Técnico de ar-condicionado',
      keywords: ['ar condicionado','ar-condicionado','nao gela','limpeza do ar','higienizacao','gas'],
      questions: ['Qual marca e capacidade?','O aparelho liga?','Quando foi feita a última manutenção?']
    },
    {
      profession: 'Diarista / Faxina',
      keywords: ['faxina','limpeza','diarista','pos obra','passar roupa','vidros'],
      questions: ['Quantos cômodos e banheiros?','É limpeza comum, pesada ou pós-obra?','Os produtos estarão no local?']
    },
    {
      profession: 'Jardineiro',
      keywords: ['jardim','grama','poda','planta','arvore','mato'],
      questions: ['Qual o tamanho da área?','Precisa retirar resíduos?','Existe árvore alta ou rede elétrica próxima?']
    },
    {
      profession: 'Montador de móveis',
      keywords: ['montar movel','guarda roupa','guarda-roupa','painel','armario','cama','mesa'],
      questions: ['Qual móvel e marca?','Está novo ou precisa de reparo?','Possui manual e peças?']
    },
    {
      profession: 'Marceneiro',
      keywords: ['marcenaria','movel planejado','gaveta','dobradica','prateleira','nicho','madeira'],
      questions: ['Possui medidas ou projeto?','Qual acabamento deseja?','É fabricação ou reparo?']
    },
    {
      profession: 'Serralheiro',
      keywords: ['portao','grade','solda','corrimao','ferro','estrutura metalica'],
      questions: ['Qual a medida?','É fabricação ou reparo?','Pode enviar fotos?']
    },
    {
      profession: 'Vidraceiro',
      keywords: ['vidro','box','espelho','janela quebrada','blindex'],
      questions: ['Qual a medida?','Qual tipo de vidro?','É instalação ou troca?']
    },
    {
      profession: 'Técnico de eletrodomésticos',
      keywords: ['geladeira','maquina de lavar','microondas','micro-ondas','fogao','eletrodomestico'],
      questions: ['Qual aparelho, marca e modelo?','Ele liga?','Qual defeito ou barulho apresenta?']
    },
    {
      profession: 'Mudanças / Frete',
      keywords: ['mudanca','frete','carreto','transportar','entrega'],
      questions: ['Quais endereços?','Quais itens e volumes?','Há escada, elevador ou ajudante?']
    }
  ];

  function normalize(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function analyze(value) {
    const text = normalize(value);
    let best = null;
    let bestScore = 0;

    for (const rule of rules) {
      let score = 0;
      for (const keyword of rule.keywords) {
        if (text.includes(normalize(keyword))) {
          score += keyword.includes(' ') ? 3 : 2;
        }
      }
      if (score > bestScore) {
        best = rule;
        bestScore = score;
      }
    }

    if (!best || !bestScore) {
      return {
        profession: 'Outros',
        confidence: 20,
        explanation: 'Não encontrei uma categoria segura. Selecione Outros ou escolha manualmente.',
        questions: ['Qual resultado você espera?','Pode enviar fotos ou medidas?','Qual o prazo desejado?']
      };
    }

    return {
      profession: best.profession,
      confidence: Math.min(96, 45 + bestScore * 8),
      explanation: `A descrição possui sinais compatíveis com ${best.profession}. Confirme antes de publicar.`,
      questions: best.questions
    };
  }

  window.OrcaSmartTriage = { analyze };
})();
