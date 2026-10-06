/**
 * K9 Ops Web — Health Web v1 F30 Reports
 * Dedicated F70 Design System PDF generators for canonical Health Web reports:
 * - WEB-HLT-01: Resumo Executivo de Saúde Canina (kpi_summary)
 * - WEB-HLT-02: Prontidão Operacional (readiness)
 * - WEB-HLT-03: Casos Clínicos (clinical)
 * - WEB-HLT-04: Agenda de Procedimentos (schedule)
 *
 * GOALS:
 * - Visibly belong to the owner-approved K9 Ops Health reporting family.
 * - Share Dark Tactical Header with official ProductMark, cyan accents, IBM Plex font stack.
 * - Landscape A4 orientation for executive and tabular density.
 * - Fail-closed, source-backed metrics only. Zero fabricated data or IDs.
 */

import type { jsPDF } from 'jspdf';
import {
  ARCHETYPE_CONFIGS,
  getCachedOfficialLogo,
  ReportTemplateBuilder,
  type MetricCardData,
  type ReportImageSlot,
} from '@/lib/reporting';
import {
  CLINICAL_CASE_STATUS_LABELS,
  SCHEDULE_STATUS_LABELS,
} from '../../domain/read-states';
import type {
  HealthReportsAggregate,
  ReportExportDataset,
} from '../domain/health-reports-types';

export interface HealthReportPdfOptions {
  logoSlot?: ReportImageSlot | null;
}

const SCHEDULE_TYPE_LABELS: Record<string, string> = {
  dose: 'Dose',
  vaccination: 'Vacinação',
  exam: 'Exame',
  consultation: 'Consulta',
  weighing: 'Pesagem',
  reevaluation: 'Reavaliação',
  deworming: 'Vermifugação',
  bath: 'Banho',
  general: 'Geral',
};

function formatPeriodLabel(period: string): string {
  switch (period) {
    case 'today':
      return 'Hoje';
    case '7d':
      return '7 dias';
    case '30d':
      return '30 dias';
    default:
      return period;
  }
}

/**
 * WEB-HLT-01: Resumo Executivo de Saúde Canina (kpi_summary)
 */
export function generateHealthKpiSummaryPdf(
  aggregate: HealthReportsAggregate,
  options?: HealthReportPdfOptions,
): jsPDF {
  const r = aggregate.readiness;
  const c = aggregate.clinical;
  const s = aggregate.schedule;
  const periodLabel = formatPeriodLabel(aggregate.period);
  const logo = options?.logoSlot ?? getCachedOfficialLogo();

  const totalDogs = r.totalDogsInScope || 1;
  const readinessPct = Math.round((r.statusCounts.operational / totalDogs) * 100);

  const builder = new ReportTemplateBuilder({
    title: 'RESUMO EXECUTIVO DE SAÚDE CANINA',
    subtitle: 'Visão executiva integrada de prontidão operacional, casos clínicos e agenda sanitária',
    category: 'COMANDO & GESTÃO SANITÁRIA',
    motto: 'DISCIPLINA · PROTEÇÃO · RESULTADO',
    metadata: {
      generatedAt: aggregate.referenceDate,
      period: periodLabel,
    },
    branding: {
      productMarkImage: logo,
    },
    useDarkFooter: true,
    archetypeConfig: {
      ...ARCHETYPE_CONFIGS.analytical,
      orientation: 'landscape',
      headerVariant: 'darkTactical',
    },
  });

  // 1. Linha Executiva de MetricCards (6 indicadores)
  const metricCards: MetricCardData[] = [
    {
      label: 'Cães no Escopo',
      value: String(r.totalDogsInScope),
      unit: 'cães',
      tone: 'neutral',
    },
    {
      label: 'Prontidão Geral',
      value: `${readinessPct}%`,
      unit: 'aptos',
      tone: r.statusCounts.operational > 0 ? 'positive' : 'attention',
    },
    {
      label: 'Restrições Ativas',
      value: String(r.activeRestrictionsCount),
      unit: 'restrições',
      tone: r.activeRestrictionsCount > 0 ? 'attention' : 'positive',
    },
    {
      label: 'Casos Ativos',
      value: String(c.activeCasesCount),
      unit: 'em curso',
      tone: c.activeCasesCount > 0 ? 'attention' : 'positive',
    },
    {
      label: 'Agenda no Período',
      value: String(s.itemsInPeriodCount),
      unit: 'procedimentos',
      tone: 'info',
    },
    {
      label: 'Procedimentos Atrasados',
      value: String(s.overdueCount),
      unit: 'atrasos',
      tone: s.overdueCount > 0 ? 'critical' : 'positive',
    },
  ];
  builder.addMetricCardRow(metricCards);

  // 2. Alertas e Destaques Operacionais
  const hasAlerts =
    s.overdueCount > 0 ||
    r.statusCounts.temporarily_unfit > 0 ||
    r.activeRestrictionsCount > 0 ||
    !r.isCoverageComplete;

  builder.addStyledSectionTitle('DIAGNÓSTICO E ALERTAS OPERACIONAIS', {
    codeText: 'KPI',
    subtitle: 'Pontos críticos de atenção e conformidade identificados no período',
  });

  if (hasAlerts) {
    const alerts: string[] = [];
    if (s.overdueCount > 0) {
      alerts.push(
        `Procedimentos com prazo expirado: ${s.overdueCount} item(ns) aguardando execução ou reagendamento imediato.`,
      );
    }
    if (r.statusCounts.temporarily_unfit > 0) {
      alerts.push(
        `Cães temporariamente inaptos: ${r.statusCounts.temporarily_unfit} cão(ães) fora de prontidão para missões policiais.`,
      );
    }
    if (r.activeRestrictionsCount > 0) {
      alerts.push(
        `Restrições operacionais ativas: ${r.activeRestrictionsCount} restrição(ões) em vigor limitando o emprego de ${r.dogsWithRestrictionsCount} cão(ães).`,
      );
    }
    if (!r.isCoverageComplete) {
      alerts.push(
        `Cobertura degradada: ${r.unevaluatedCount} cão(ães) sem projeção válida de prontidão registrada.`,
      );
    }

    builder.addSummary({
      title: 'ATENÇÃO OPERACIONAL — PONTOS DE VIGILÂNCIA SANITÁRIA',
      description:
        'Foram identificadas demandas prioritárias que requerem intervenção do comando ou da equipe médica:',
      bulletItems: alerts,
      tone: s.overdueCount > 0 ? 'critical' : 'attention',
    });
  } else {
    builder.addSummary({
      title: 'CONFORMIDADE OPERACIONAL PLENA',
      description:
        'Efetivo canino em plena conformidade sanitária. Sem atrasos de procedimento ou inaptidões não assistidas no período.',
      bulletItems: [
        `100% dos ${r.totalDogsInScope} cães com projeção de prontidão válida e atualizada.`,
        'Nenhum procedimento sanitário vencido aguardando realização.',
      ],
      tone: 'positive',
    });
  }

  // 3. Distribuição de Capacidade e Saúde
  builder.addStyledSectionTitle('DISTRIBUIÇÃO DE CAPACIDADE E CASOS', {
    codeText: 'DIST',
    subtitle: 'Síntese das categorias de aptidão e acompanhamento médico',
  });

  builder.addSummary({
    title: 'Síntese da Capacidade e Casos Clínicos',
    bulletItems: [
      `Aptidão Operacional: ${r.statusCounts.operational} Aptos Plenos · ${r.statusCounts.operational_attention} Atenção · ${r.statusCounts.fit_with_restrictions} Com Restrições · ${r.statusCounts.temporarily_unfit} Inaptos`,
      `Casos Clínicos: ${c.totalCases} total · ${c.activeCasesCount} ativos · ${c.casesOpenedInPeriodCount} abertos no período · ${c.casesWithActiveRestrictionCount} c/ restrição`,
      `Agenda Sanitária: ${s.totalItems} total · ${s.itemsInPeriodCount} no período (${periodLabel}) · ${s.todayCount} previstos para hoje`,
    ],
    tone: 'neutral',
  });

  // 4. Tabela Executiva Consolidada
  builder.addStyledSectionTitle('INDICADORES CONSOLIDADOS POR MÓDULO', {
    codeText: 'TAB',
    subtitle: 'Métricas analíticas do efetivo canino para decisões de comando',
  });

  builder.addDataTable({
    columns: [
      { header: 'Módulo / Categoria', key: 'modulo', width: 60 },
      { header: 'Indicador / Métrica', key: 'indicador', width: 95 },
      { header: 'Valor', key: 'valor', width: 45, alignment: 'right', isMonospace: true },
      { header: 'Status / Cobertura', key: 'status', width: 73 },
    ],
    rows: [
      {
        modulo: 'Prontidão Operacional',
        indicador: 'Cães no Escopo Institucional',
        valor: String(r.totalDogsInScope),
        status: r.isCoverageComplete ? '100% Avaliado' : `${r.unevaluatedCount} sem projeção`,
      },
      {
        modulo: 'Prontidão Operacional',
        indicador: 'Operacionais (Aptidão Plena)',
        valor: String(r.statusCounts.operational),
        status: `${readinessPct}% do efetivo`,
      },
      {
        modulo: 'Prontidão Operacional',
        indicador: 'Operacional com Atenção',
        valor: String(r.statusCounts.operational_attention),
        status: 'Monitoramento preventivo',
      },
      {
        modulo: 'Prontidão Operacional',
        indicador: 'Apto com Restrições',
        valor: String(r.statusCounts.fit_with_restrictions),
        status: 'Emprego condicionado',
      },
      {
        modulo: 'Prontidão Operacional',
        indicador: 'Temporariamente Inaptos',
        valor: String(r.statusCounts.temporarily_unfit),
        status: r.statusCounts.temporarily_unfit > 0 ? 'Afastamento temporário' : 'Nenhum',
      },
      {
        modulo: 'Prontidão Operacional',
        indicador: 'Restrições Ativas Totais',
        valor: String(r.activeRestrictionsCount),
        status: r.restrictionsCoverageComplete ? 'Cobertura completa' : 'Parcial / Incompleta',
      },
      {
        modulo: 'Casos Clínicos',
        indicador: 'Total de Casos Registrados',
        valor: String(c.totalCases),
        status: c.coverage.complete ? 'Cobertura completa' : 'Parcial',
      },
      {
        modulo: 'Casos Clínicos',
        indicador: 'Casos Ativos em Tratamento/Acompanhamento',
        valor: String(c.activeCasesCount),
        status: c.activeCasesCount > 0 ? 'Em curso' : 'Nenhum ativo',
      },
      {
        modulo: 'Casos Clínicos',
        indicador: `Casos Abertos no Período (${periodLabel})`,
        valor: String(c.casesOpenedInPeriodCount),
        status: 'Novas ocorrências',
      },
      {
        modulo: 'Agenda de Procedimentos',
        indicador: 'Procedimentos Totais no Escopo',
        valor: String(s.totalItems),
        status: s.coverage.complete ? 'Cobertura completa' : 'Parcial',
      },
      {
        modulo: 'Agenda de Procedimentos',
        indicador: `Procedimentos no Período (${periodLabel})`,
        valor: String(s.itemsInPeriodCount),
        status: 'Cronograma da janela',
      },
      {
        modulo: 'Agenda de Procedimentos',
        indicador: 'Procedimentos Atrasados (Atenção)',
        valor: String(s.overdueCount),
        status: s.overdueCount > 0 ? 'Ação requerida imediata' : 'Em dia',
      },
      {
        modulo: 'Agenda de Procedimentos',
        indicador: 'Procedimentos Previstos para Hoje',
        valor: String(s.todayCount),
        status: 'Compromissos do dia',
      },
    ],
  });

  return builder.build();
}

/**
 * WEB-HLT-02: Prontidão Operacional (readiness)
 */
export function generateHealthReadinessPdf(
  aggregate: HealthReportsAggregate,
  options?: HealthReportPdfOptions,
): jsPDF {
  const r = aggregate.readiness;
  const periodLabel = formatPeriodLabel(aggregate.period);
  const logo = options?.logoSlot ?? getCachedOfficialLogo();

  const totalDogs = r.totalDogsInScope || 1;
  const operationalPct = Math.round((r.statusCounts.operational / totalDogs) * 100);
  const attentionRestrictedCount =
    r.statusCounts.operational_attention + r.statusCounts.fit_with_restrictions;

  const builder = new ReportTemplateBuilder({
    title: 'RELATÓRIO DE PRONTIDÃO OPERACIONAL',
    subtitle: 'Avaliação de capacidade operacional, restrições ativas e status de aptidão do efetivo canino',
    category: 'CAPACIDADE & EFETIVO K9',
    motto: 'DISCIPLINA · PROTEÇÃO · RESULTADO',
    metadata: {
      generatedAt: aggregate.referenceDate,
      period: periodLabel,
    },
    branding: {
      productMarkImage: logo,
    },
    useDarkFooter: true,
    archetypeConfig: {
      ...ARCHETYPE_CONFIGS.operational,
      orientation: 'landscape',
      headerVariant: 'darkTactical',
    },
  });

  // 1. Linha de Métricas de Prontidão (5 indicadores)
  const metricCards: MetricCardData[] = [
    {
      label: 'Efetivo no Escopo',
      value: String(r.totalDogsInScope),
      unit: 'cães',
      tone: 'neutral',
    },
    {
      label: 'Operacionais (Aptos)',
      value: String(r.statusCounts.operational),
      unit: `${operationalPct}%`,
      tone: 'positive',
    },
    {
      label: 'Atenção / Restrição',
      value: String(attentionRestrictedCount),
      unit: 'cães',
      tone: attentionRestrictedCount > 0 ? 'attention' : 'positive',
    },
    {
      label: 'Inaptos Temporários',
      value: String(r.statusCounts.temporarily_unfit),
      unit: 'cães',
      tone: r.statusCounts.temporarily_unfit > 0 ? 'critical' : 'neutral',
    },
    {
      label: 'Restrições Ativas',
      value: String(r.activeRestrictionsCount),
      unit: 'total',
      tone: r.activeRestrictionsCount > 0 ? 'attention' : 'positive',
    },
  ];
  builder.addMetricCardRow(metricCards);

  // 2. Diagnóstico de Cobertura e Restrições
  builder.addStyledSectionTitle('DIAGNÓSTICO DE COBERTURA E RESTRIÇÕES', {
    codeText: 'OPS',
    subtitle: 'Integridade dos dados de projeção e discriminação de restrições sanitárias',
  });

  builder.addSummary({
    title: 'Diagnóstico da Avaliação de Prontidão do Efetivo',
    description: r.isCoverageComplete
      ? '100% dos cães em escopo institucional possuem avaliação de prontidão válida e atualizada.'
      : `Atenção: ${r.unevaluatedCount} cão(ães) apresentam projeção parcial ou degradada necessitando de revisão cadastral.`,
    bulletItems: [
      `Restrições Absolutas: ${r.restrictionsByType.absolute} (afastamento total de atividades operacionais)`,
      `Restrições Parciais: ${r.restrictionsByType.partial} (emprego condicionado a restrições veterinárias específicas)`,
      `Restrições de Atenção: ${r.restrictionsByType.attention} (monitoramento sem impedimento operacional)`,
      `Cães com Restrições Ativas: ${r.dogsWithRestrictionsCount} cão(ães) com pelo menos uma restrição em vigor`,
    ],
    tone: r.isCoverageComplete ? 'positive' : 'attention',
  });

  // 3. Tabela de Classificação de Aptidão Operacional
  builder.addStyledSectionTitle('CLASSIFICAÇÃO DE APTIDÃO OPERACIONAL', {
    codeText: 'EFET',
    subtitle: 'Distribuição do efetivo por estado canônico e diretriz de emprego tático',
  });

  builder.addDataTable({
    columns: [
      { header: 'Status de Prontidão', key: 'status', width: 55 },
      { header: 'Classificação Operacional', key: 'classificacao', width: 65 },
      { header: 'Quantidade', key: 'quantidade', width: 30, alignment: 'right', isMonospace: true },
      { header: '% Efetivo', key: 'percentual', width: 35, alignment: 'right', isMonospace: true },
      { header: 'Diretriz de Emprego Tático', key: 'diretriz', width: 88 },
    ],
    rows: [
      {
        status: 'Operacional',
        classificacao: 'Aptidão Plena',
        quantidade: String(r.statusCounts.operational),
        percentual: `${Math.round((r.statusCounts.operational / totalDogs) * 100)}%`,
        diretriz: 'Disponível para qualquer missão policial, patrulhamento ou intervenção tática.',
      },
      {
        status: 'Operacional com Atenção',
        classificacao: 'Monitoramento Preventivo',
        quantidade: String(r.statusCounts.operational_attention),
        percentual: `${Math.round((r.statusCounts.operational_attention / totalDogs) * 100)}%`,
        diretriz: 'Emprego autorizado com acompanhamento pré e pós-turno pela guarnição condutora.',
      },
      {
        status: 'Apto com Restrições',
        classificacao: 'Emprego Condicionado',
        quantidade: String(r.statusCounts.fit_with_restrictions),
        percentual: `${Math.round((r.statusCounts.fit_with_restrictions / totalDogs) * 100)}%`,
        diretriz: 'Emprego estritamente condicionado às restrições veterinárias ativas do prontuário.',
      },
      {
        status: 'Temporariamente Inapto',
        classificacao: 'Afastamento Médico',
        quantidade: String(r.statusCounts.temporarily_unfit),
        percentual: `${Math.round((r.statusCounts.temporarily_unfit / totalDogs) * 100)}%`,
        diretriz: 'Vedado qualquer emprego operacional até reavaliação médica e alta clínica formal.',
      },
    ],
  });

  return builder.build();
}

/**
 * WEB-HLT-03: Casos Clínicos (clinical)
 */
export function generateHealthClinicalCasesPdf(
  aggregate: HealthReportsAggregate,
  options?: HealthReportPdfOptions,
): jsPDF {
  const c = aggregate.clinical;
  const periodLabel = formatPeriodLabel(aggregate.period);
  const logo = options?.logoSlot ?? getCachedOfficialLogo();

  const builder = new ReportTemplateBuilder({
    title: 'RELATÓRIO DE CASOS CLÍNICOS',
    subtitle: 'Acompanhamento de ocorrências médicas, condutas terapêuticas e evolução clínica',
    category: 'PRONTUÁRIO VETERINÁRIO',
    motto: 'DISCIPLINA · PROTEÇÃO · RESULTADO',
    metadata: {
      generatedAt: aggregate.referenceDate,
      period: periodLabel,
    },
    branding: {
      productMarkImage: logo,
    },
    useDarkFooter: true,
    archetypeConfig: {
      ...ARCHETYPE_CONFIGS.clinical,
      orientation: 'landscape',
      headerVariant: 'darkTactical',
    },
  });

  // 1. Linha de Métricas de Casos Clínicos (5 indicadores)
  const metricCards: MetricCardData[] = [
    {
      label: 'Total de Casos',
      value: String(c.totalCases),
      unit: 'registros',
      tone: 'neutral',
    },
    {
      label: 'Casos Ativos',
      value: String(c.activeCasesCount),
      unit: 'em curso',
      tone: c.activeCasesCount > 0 ? 'attention' : 'positive',
    },
    {
      label: 'Abertos no Período',
      value: String(c.casesOpenedInPeriodCount),
      unit: 'novos',
      tone: 'info',
    },
    {
      label: 'Casos c/ Restrição',
      value: String(c.casesWithActiveRestrictionCount),
      unit: 'com restrição',
      tone: c.casesWithActiveRestrictionCount > 0 ? 'critical' : 'positive',
    },
    {
      label: 'Casos c/ Agenda',
      value: String(c.casesWithPendingScheduleCount),
      unit: 'agenda pendente',
      tone: c.casesWithPendingScheduleCount > 0 ? 'attention' : 'neutral',
    },
  ];
  builder.addMetricCardRow(metricCards);

  // 2. Síntese dos Casos Clínicos em Vigor
  builder.addStyledSectionTitle('SÍNTESE DOS CASOS CLÍNICOS EM VIGOR', {
    codeText: 'RES',
    subtitle: 'Estatísticas por estágio clínico e cobertura dos registros',
  });

  builder.addSummary({
    title: 'Síntese do Plantão Clínico Veterinário',
    bulletItems: [
      `Em Tratamento: ${c.casesByStatus.under_treatment ?? 0} caso(s)`,
      `Sob Investigação / Exames: ${c.casesByStatus.under_investigation ?? 0} caso(s)`,
      `Em Monitoramento Clínico: ${c.casesByStatus.monitoring ?? 0} caso(s)`,
      `Abertos Recentes: ${c.casesByStatus.open ?? 0} caso(s)`,
      `Alta Clínica / Encerrados: ${(c.casesByStatus.discharged ?? 0) + (c.casesByStatus.cancelled ?? 0)} caso(s)`,
      `Integridade dos Registros: ${c.coverage.complete ? '100% dos dados acessíveis' : 'Leitura parcial de casos'}`,
    ],
    tone: c.activeCasesCount > 0 ? 'attention' : 'positive',
  });

  // 3. Tabela Detalhada de Casos Clínicos
  builder.addStyledSectionTitle('REGISTRO DE CASOS CLÍNICOS', {
    codeText: 'CASOS',
    subtitle: 'Relação individualizada de casos clínicos por cão com restrições e pendências',
  });

  if (aggregate.filteredClinicalCases.length === 0) {
    builder.addObservations({
      title: 'CASOS CLÍNICOS',
      text: 'Nenhum caso clínico encontrado para os filtros e período selecionados.',
    });
  } else {
    builder.addDataTable({
      columns: [
        { header: 'Cão', key: 'dog', width: 45 },
        { header: 'Título / Descrição do Caso', key: 'title', width: 85 },
        { header: 'Status Clínico', key: 'status', width: 45, alignment: 'center' },
        { header: 'Data de Abertura', key: 'abertura', width: 33, alignment: 'center', isMonospace: true },
        { header: 'Restrição Ativa', key: 'restricao', width: 32, alignment: 'center' },
        { header: 'Agenda Pendente', key: 'agenda', width: 33, alignment: 'center' },
      ],
      rows: aggregate.filteredClinicalCases.map((entry) => {
        const cs = entry.case;
        const statusLabel = cs.clinicalStatus
          ? CLINICAL_CASE_STATUS_LABELS[cs.clinicalStatus] ?? cs.rawClinicalStatus ?? 'Desconhecido'
          : cs.rawClinicalStatus ?? 'Não informado';

        const openedStr = cs.openedAt
          ? cs.openedAt.toLocaleDateString('pt-BR')
          : 'Não informada';

        return {
          dog: entry.dog.name,
          title: cs.title ?? `Caso #${cs.caseId}`,
          status: statusLabel,
          abertura: openedStr,
          restricao: cs.hasActiveRestriction === true ? 'Sim' : cs.hasActiveRestriction === false ? 'Não' : 'N/D',
          agenda: cs.hasPendingSchedule === true ? 'Sim' : cs.hasPendingSchedule === false ? 'Não' : 'N/D',
        };
      }),
    });
  }

  return builder.build();
}

/**
 * WEB-HLT-04: Agenda de Procedimentos (schedule)
 */
export function generateHealthSchedulePdf(
  aggregate: HealthReportsAggregate,
  options?: HealthReportPdfOptions,
): jsPDF {
  const s = aggregate.schedule;
  const periodLabel = formatPeriodLabel(aggregate.period);
  const logo = options?.logoSlot ?? getCachedOfficialLogo();

  const builder = new ReportTemplateBuilder({
    title: 'RELATÓRIO DA AGENDA DE PROCEDIMENTOS',
    subtitle: 'Planejamento e controle temporal de intervenções veterinárias e manejo',
    category: 'AGENDA & MANEJO SANITÁRIO',
    motto: 'DISCIPLINA · PROTEÇÃO · RESULTADO',
    metadata: {
      generatedAt: aggregate.referenceDate,
      period: periodLabel,
    },
    branding: {
      productMarkImage: logo,
    },
    useDarkFooter: true,
    archetypeConfig: {
      ...ARCHETYPE_CONFIGS.operational,
      orientation: 'landscape',
      headerVariant: 'darkTactical',
    },
  });

  // 1. Linha de Métricas da Agenda (5 indicadores)
  const metricCards: MetricCardData[] = [
    {
      label: 'No Período',
      value: String(s.itemsInPeriodCount),
      unit: `${periodLabel}`,
      tone: 'info',
    },
    {
      label: 'Atrasados (Atenção)',
      value: String(s.overdueCount),
      unit: 'vencidos',
      tone: s.overdueCount > 0 ? 'critical' : 'positive',
    },
    {
      label: 'Previstos Hoje',
      value: String(s.todayCount),
      unit: 'para hoje',
      tone: s.todayCount > 0 ? 'attention' : 'neutral',
    },
    {
      label: 'Próximos / Futuros',
      value: String(s.upcomingCount),
      unit: 'futuros',
      tone: 'neutral',
    },
    {
      label: 'Total no Escopo',
      value: String(s.totalItems),
      unit: 'total',
      tone: 'neutral',
    },
  ];
  builder.addMetricCardRow(metricCards);

  // 2. Cronograma e Alertas
  builder.addStyledSectionTitle('CRONOGRAMA E ALERTAS DE PROCEDIMENTOS', {
    codeText: 'AGENDA',
    subtitle: 'Alertas de vencimento e distribuição por tipo de intervenção sanitária',
  });

  if (s.overdueCount > 0) {
    builder.addSummary({
      title: 'ALERTA SANITÁRIO — PROCEDIMENTOS PENDENTES COM ATRASO',
      description: `Existe(m) ${s.overdueCount} procedimento(s) vencido(s) aguardando execução ou reagendamento urgente.`,
      bulletItems: [
        `Procedimentos com prazo expirado: ${s.overdueCount}`,
        `Procedimentos agendados para hoje: ${s.todayCount}`,
        `Procedimentos futuros na janela (${periodLabel}): ${s.upcomingCount}`,
      ],
      tone: 'critical',
    });
  } else {
    builder.addSummary({
      title: 'CRONOGRAMA SANITÁRIO EM CONFORMIDADE',
      description: 'Nenhum procedimento atrasado. O cronograma sanitário do canil segue regular.',
      bulletItems: [
        `Procedimentos previstos para hoje: ${s.todayCount}`,
        `Procedimentos futuros na janela (${periodLabel}): ${s.upcomingCount}`,
        `Total de procedimentos no período: ${s.itemsInPeriodCount}`,
      ],
      tone: 'positive',
    });
  }

  // 3. Tabela Detalhada de Procedimentos
  builder.addStyledSectionTitle('REGISTRO DE PROCEDIMENTOS AGENDADOS', {
    codeText: 'PROC',
    subtitle: 'Relação individualizada de procedimentos por cão e situação temporal',
  });

  if (aggregate.filteredScheduleItems.length === 0) {
    builder.addObservations({
      title: 'AGENDA SANITÁRIA',
      text: 'Nenhum procedimento na agenda encontrado para os filtros e período selecionados.',
    });
  } else {
    builder.addDataTable({
      columns: [
        { header: 'Cão', key: 'dog', width: 45 },
        { header: 'Procedimento / Título', key: 'title', width: 85 },
        { header: 'Tipo', key: 'tipo', width: 40 },
        { header: 'Data / Hora Prevista', key: 'data', width: 55, alignment: 'center', isMonospace: true },
        { header: 'Situação Temporal', key: 'status', width: 48, alignment: 'center' },
      ],
      rows: aggregate.filteredScheduleItems.map((entry) => {
        const item = entry.entry.item;
        const status = entry.temporal.temporalStatus;
        const statusText = status ? SCHEDULE_STATUS_LABELS[status] ?? status : 'Indisponível';

        const typeLabel = item.scheduleType
          ? SCHEDULE_TYPE_LABELS[item.scheduleType] ?? item.scheduleType
          : 'Geral';

        const scheduledStr = item.scheduledFor
          ? item.scheduledFor.toLocaleString('pt-BR', {
              timeZone: item.timezone ?? undefined,
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
          : 'Data indisponível';

        return {
          dog: entry.entry.dog.name,
          title: item.title ?? 'Sem título',
          tipo: typeLabel,
          data: scheduledStr,
          status: statusText,
        };
      }),
    });
  }

  return builder.build();
}

/**
 * Dispatcher central para geração do documento jsPDF F70 conforme o dataset solicitado.
 */
export function generateHealthReportPdf(
  dataset: ReportExportDataset,
  aggregate: HealthReportsAggregate,
  options?: HealthReportPdfOptions,
): jsPDF {
  switch (dataset) {
    case 'readiness':
      return generateHealthReadinessPdf(aggregate, options);
    case 'clinical':
      return generateHealthClinicalCasesPdf(aggregate, options);
    case 'schedule':
      return generateHealthSchedulePdf(aggregate, options);
    case 'kpi_summary':
    default:
      return generateHealthKpiSummaryPdf(aggregate, options);
  }
}

/**
 * Exporta o relatório em PDF acionando o download no browser ou salvando o arquivo.
 */
export function exportHealthReportPdf(
  dataset: ReportExportDataset,
  aggregate: HealthReportsAggregate,
  options?: HealthReportPdfOptions,
): void {
  const doc = generateHealthReportPdf(dataset, aggregate, options);
  const dateStr = aggregate.referenceDate.toISOString().slice(0, 10);
  const filename =
    dataset === 'kpi_summary'
      ? `resumo-saude-${aggregate.period}-${dateStr}.pdf`
      : dataset === 'readiness'
        ? `relatorio-prontidao-${dateStr}.pdf`
        : dataset === 'clinical'
          ? `relatorio-casos-clinicos-${aggregate.period}-${dateStr}.pdf`
          : `relatorio-agenda-${aggregate.period}-${dateStr}.pdf`;

  doc.save(filename);
}
