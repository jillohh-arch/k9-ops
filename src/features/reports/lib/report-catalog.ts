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
  | "Administraçao"
  | "Logistica"
  | "Operacional"
  | "Saúde";

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
    title: "Ocorrências",
    tone: "cyan",
  },
  {
    category: "Logistica",
    description: "Movimentações, níveis de estoque, consumo e inventário.",
    href: `${reportsBasePath}/inventory`,
    id: "inventory",
    indicators: 9,
    title: "Estoque",
    tone: "emerald",
  },
  {
    category: "Operacional",
    description: "Efetivo K9, humano, binômios, status e movimentações.",
    href: `${reportsBasePath}/effective`,
    id: "effective",
    indicators: 11,
    title: "Efetivo",
    tone: "blue",
  },
  {
    category: "Operacional",
    description: "Drogas e materiais apreendidos por tipo, peso e ocorrência.",
    href: `${reportsBasePath}/apprehensions`,
    id: "apprehensions",
    indicators: 7,
    title: "Apreensões",
    tone: "amber",
  },
  {
    category: "Logistica",
    description: "Frota, utilização, status, manutenção e documentação.",
    href: `${reportsBasePath}/vehicles`,
    id: "vehicles",
    indicators: 6,
    title: "Viaturas",
    tone: "cyan",
  },
  {
    category: "Saúde",
    description: "Atendimentos, exames, vacinas e prontidão veterinária.",
    href: `${reportsBasePath}/health`,
    id: "health",
    indicators: 10,
    title: "Saúde",
    tone: "red",
  },
  {
    category: "Operacional",
    description: "Sessões, modalidades, evolução, frequência e certificações.",
    href: `${reportsBasePath}/training`,
    id: "training",
    indicators: 8,
    title: "Treinos",
    tone: "violet",
  },
  {
    category: "Operacional",
    description: "Desempenho, prontidão e produtividade dos binômios.",
    href: `${reportsBasePath}/binomials`,
    id: "binomials",
    indicators: 8,
    title: "Binômios",
    tone: "emerald",
  },
  {
    category: "Administraçao",
    description: "Integridade, assinaturas, divergencias e eventos auditados.",
    href: `${reportsBasePath}/audit`,
    id: "audit",
    indicators: 9,
    title: "Auditoria",
    tone: "blue",
  },
  {
    category: "Administraçao",
    description: "Visão executiva consolidada da produtividade da unidade.",
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
  "Saúde",
  "Administraçao",
];

export function getReportDefinition(id: ReportId) {
  return reportDefinitions.find((report) => report.id === id) ?? null;
}
