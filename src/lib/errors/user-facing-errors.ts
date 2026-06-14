const sourceLabels: Array<{ label: string; pattern: RegExp }> = [
  { label: "Turnos ativos", pattern: /\bactive_shifts\b/i },
  { label: "Registros de auditoria", pattern: /\bauditLogs\b/i },
  { label: "Binômios", pattern: /\bbinomials\b/i },
  { label: "Efetivo K9", pattern: /\bdogs\b/i },
  { label: "Eventos de saúde", pattern: /\bhealth_events\b/i },
  { label: "Histórico de saúde", pattern: /\bhealth_logs\b/i },
  { label: "Itens de estoque", pattern: /\binventory_items\b/i },
  {
    label: "Movimentações de estoque",
    pattern: /\binventory_movements\b/i,
  },
  { label: "Ocorrências", pattern: /\boccurrences\b/i },
  { label: "Solicitações de evolução", pattern: /\bpromotion_requests\b/i },
  { label: "Registros de treinamento", pattern: /\btrainings\b/i },
  { label: "Sessões de treinamento", pattern: /\btraining_sessions\b/i },
  { label: "Currículos de treinamento", pattern: /\btraining_programs\b/i },
  { label: "Módulos do currículo", pattern: /\bmodules\b/i },
  { label: "Marcos do currículo", pattern: /\bmilestones\b/i },
  { label: "Efetivo humano", pattern: /\busers\b/i },
  { label: "Guarnições", pattern: /\bvehicle_crews\b/i },
  { label: "Viaturas", pattern: /\bvehicles\b/i },
  { label: "Registros de pesagem", pattern: /\bweight_records\b/i },
  { label: "Documentos", pattern: /\bdocuments\b|\bdocumentos\b/i },
];

function sourceLabel(error: string) {
  return sourceLabels.find(({ pattern }) => pattern.test(error))?.label ?? null;
}

function isPermissionError(error: string) {
  return /permission-denied|missing or insufficient permissions|does not have permission|insufficient permission/i.test(
    error,
  );
}

function isAvailabilityError(error: string) {
  return /unavailable|network|offline|deadline-exceeded|timeout|failed-precondition/i.test(
    error,
  );
}

export function humanizeSourceError(error: string) {
  const label = sourceLabel(error);
  const prefix = label ? `${label}: ` : "";

  if (isPermissionError(error)) {
    return `${prefix}acesso indisponível para este perfil.`;
  }

  if (isAvailabilityError(error)) {
    return `${prefix}dados temporáriamente indisponíveis.`;
  }

  return `${prefix}não foi possível atualizar os dados.`;
}

export function humanizeSourceErrors(errors: string[]) {
  return Array.from(
    new Set(
      errors
        .map((error) => humanizeSourceError(error))
        .filter((message) => message.trim().length > 0),
    ),
  );
}
