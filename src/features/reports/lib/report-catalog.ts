export type ReportId =
  | "apprehensions"
  | "audit"
  | "binomials"
  | "effective"
  | "health"
  | "inventory"
  | "occurrences"
  | "productivity"
  | "training"
  | "vehicles";

export type ReportTone =
  | "amber"
  | "blue"
  | "cyan"
  | "emerald"
  | "red"
  | "slate"
  | "violet";

export type ReportCategory =
  | "Administracao"
  | "Logistica"
  | "Operacional"
  | "Saude";

export type ReportDefinition = {
  category: ReportCategory;
  description: string;
  href: string;
  id: ReportId;
  indicators: number;
  title: string;
  tone: ReportTone;
};

export const reportsBasePath = "/reports";

export const reportDefinitions: ReportDefinition[] = [
  {
    category: "Operacional",
    description:
      "Atendimentos, criticidade, produtividade e status operacional.",
    href: `${reportsBasePath}/occurrences`,
    id: "occurrences",
    indicators: 12,
    title: "Ocorrencias",
    tone: "cyan",
  },
  {
    category: "Logistica",
    description: "Movimentacoes, niveis de estoque, consumo e inventario.",
    href: `${reportsBasePath}/inventory`,
    id: "inventory",
    indicators: 9,
    title: "Estoque",
    tone: "emerald",
  },
  {
    category: "Operacional",
    description: "Efetivo K9, humano, binomios, status e movimentacoes.",
    href: `${reportsBasePath}/effective`,
    id: "effective",
    indicators: 11,
    title: "Efetivo",
    tone: "blue",
  },
  {
    category: "Operacional",
    description: "Drogas e materiais apreendidos por tipo, peso e ocorrencia.",
    href: `${reportsBasePath}/apprehensions`,
    id: "apprehensions",
    indicators: 7,
    title: "Apreensoes",
    tone: "amber",
  },
  {
    category: "Logistica",
    description: "Frota, utilizacao, status, manutencao e documentacao.",
    href: `${reportsBasePath}/vehicles`,
    id: "vehicles",
    indicators: 6,
    title: "Viaturas",
    tone: "cyan",
  },
  {
    category: "Saude",
    description: "Atendimentos, exames, vacinas e prontidao veterinaria.",
    href: `${reportsBasePath}/health`,
    id: "health",
    indicators: 10,
    title: "Saude",
    tone: "red",
  },
  {
    category: "Operacional",
    description: "Sessoes, modalidades, evolucao, frequencia e certificacoes.",
    href: `${reportsBasePath}/training`,
    id: "training",
    indicators: 8,
    title: "Treinos",
    tone: "violet",
  },
  {
    category: "Operacional",
    description: "Desempenho, prontidao e produtividade dos binomios.",
    href: `${reportsBasePath}/binomials`,
    id: "binomials",
    indicators: 8,
    title: "Binomios",
    tone: "emerald",
  },
  {
    category: "Administracao",
    description: "Integridade, assinaturas, divergencias e eventos auditados.",
    href: `${reportsBasePath}/audit`,
    id: "audit",
    indicators: 9,
    title: "Auditoria",
    tone: "blue",
  },
  {
    category: "Administracao",
    description: "Visao executiva consolidada da produtividade da unidade.",
    href: `${reportsBasePath}/productivity`,
    id: "productivity",
    indicators: 10,
    title: "Produtividade Operacional",
    tone: "emerald",
  },
];

export const reportCategories: Array<"Todos" | ReportCategory> = [
  "Todos",
  "Operacional",
  "Logistica",
  "Saude",
  "Administracao",
];

export function getReportDefinition(id: ReportId) {
  return reportDefinitions.find((report) => report.id === id) ?? null;
}
