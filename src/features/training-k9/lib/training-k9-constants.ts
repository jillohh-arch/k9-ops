export type TrainingTab =
  | "overview"
  | "dogs"
  | "sessions"
  | "evaluations"
  | "reports";

export const trainingTabs: Array<{
  id: TrainingTab;
  label: string;
}> = [
  { id: "overview", label: "Visão Geral" },
  { id: "dogs", label: "Cães em Treinamento" },
  { id: "sessions", label: "Sessões" },
  { id: "evaluations", label: "Avaliações" },
  { id: "reports", label: "Relatórios" },
];

export const defaultTab: TrainingTab = "overview";

export function isValidTab(value: string | null): value is TrainingTab {
  return trainingTabs.some((tab) => tab.id === value);
}
