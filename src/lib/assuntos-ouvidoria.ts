export interface AssuntoOuvidoria {
  grupo: string;
  itens: string[];
}

export const ASSUNTOS_OUVIDORIA: AssuntoOuvidoria[] = [
  {
    grupo: "Assistência Social",
    itens: ["Assistência Social"],
  },
  {
    grupo: "Conduta de Funcionários",
    itens: ["Conduta de Funcionários"],
  },
  {
    grupo: "Creches e Escolas",
    itens: ["Creches e Escolas"],
  },
  {
    grupo: "Denúncia de Assédio",
    itens: ["Denúncia de Assédio"],
  },
  {
    grupo: "Esgoto",
    itens: ["Esgoto"],
  },
  {
    grupo: "Estabelecimento irregular",
    itens: [
      "Condição sanitária irregular",
      "Estabelecimento com acessibilidade irregular",
      "Estabelecimento irregular",
      "Estabelecimento sem alvará",
      "Estabelecimento sem nota fiscal",
      "Estabelecimento sem saída de emergência",
    ],
  },
  {
    grupo: "Falta de Higiene",
    itens: ["Falta de Higiene"],
  },
  {
    grupo: "Mercadorias vencidas",
    itens: ["Mercadorias vencidas"],
  },
  {
    grupo: "Ocupação irregular de área pública",
    itens: ["Ocupação irregular de área pública"],
  },
  {
    grupo: "Governo",
    itens: [
      "Abuso de poder",
      "Demora em processo",
      "Desorganização",
      "Desvio de função",
      "Desvio de verba pública",
      "Nepotismo",
    ],
  },
  {
    grupo: "Iluminação e Energia",
    itens: ["Iluminação e Energia"],
  },
  {
    grupo: "Limpeza e Conservação",
    itens: [
      "Coleta de Lixo Comum",
      "Coleta pesada",
      "Entulho em via pública",
      "Limpeza em terreno baldio",
      "Limpeza urbana",
      "Mato alto",
      "Poda de árvores de rua",
    ],
  },
  {
    grupo: "Meio Ambiente",
    itens: [
      "Aterro sanitário irregular",
      "Desmatamento irregular",
      "Maus tratos a animais",
      "Poluição Ambiental",
      "Queimada irregular",
    ],
  },
  {
    grupo: "Pagamentos",
    itens: ["Pagamentos"],
  },
  {
    grupo: "Praça e/ou quadra para lazer e esportes",
    itens: ["Praça e ou quadra para lazer e esportes"],
  },
  {
    grupo: "Programas Sociais",
    itens: ["Programas Socias"],
  },
  {
    grupo: "Recursos Humanos",
    itens: ["Recursos Humanos"],
  },
  {
    grupo: "Saúde",
    itens: [
      "Demora em marcar consulta / procedimento",
      "Falta de materiais em Posto de Saúde",
      "Falta de medicação",
      "Foco de dengue",
      "Infestação / Proliferação de animais ou pragas",
      "Médicos",
      "Postos de Saúde",
      "Transporte para tratamento",
      "Vacinas",
    ],
  },
  {
    grupo: "Segurança",
    itens: [
      "Baderna",
      "Ponto de assalto/roubo",
      "Ponto de tráfico de drogas",
      "Risco de desmoronamento",
    ],
  },
  {
    grupo: "Trânsito e Vias",
    itens: [
      "Acessibilidade para deficientes visuais",
      "Asfalto",
      "Bloqueio na via",
      "Buraco",
      "Calçadas",
      "Estacionamento irregular",
      "Faixa de pedestre",
      "Lombadas",
      "Placas de sinalização",
      "Semáforos",
      "Via sem pavimentação (Estrada de chão)",
    ],
  },
  {
    grupo: "Transporte Público",
    itens: [
      "Horários",
      "Ônibus danificado",
      "Ponto de ônibus",
      "Super-lotação",
      "Transporte irregular",
    ],
  },
  {
    grupo: "Urbanismo e Infraestrutura",
    itens: [
      "Construção Irregular",
      "Demora em Obra Pública",
      "Fiscalização de Obras",
      "Imóvel abandonado",
      "Invasão de área pública",
      "Serviço mal feito",
    ],
  },
];

export const GRUPOS_ASSUNTOS = ASSUNTOS_OUVIDORIA.map((a) => a.grupo);
