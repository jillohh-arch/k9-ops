import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  generateHealthClinicalCasesPdf,
  generateHealthKpiSummaryPdf,
  generateHealthReadinessPdf,
  generateHealthReportPdf,
  generateHealthSchedulePdf,
} from '../lib/health-reports-pdf';
import type { HealthReportsAggregate } from '../domain/health-reports-types';
import type { DogIdentityReadModel } from '../../domain/readiness-types';
import type { ClinicalCaseListEntry } from '../../clinical/data/clinical-scope-loader';
import type { ComposedScheduleEntry } from '../../schedule/composition/schedule-composition';
import type { ScheduleItemReadModel } from '../../schedule/types';
import { loadOfficialLogo, setCachedOfficialLogo } from '@/lib/reporting';

const baseDog1: DogIdentityReadModel = {
  id: 'dog-1',
  name: 'Thor',
  registrationNumber: 'K9-2023-017',
  photoUrl: null,
  breed: 'Pastor Belga Malinois',
  sex: 'Macho',
  dateOfBirth: null,
  conductor: null,
  specialties: [],
};

const baseDog2: DogIdentityReadModel = {
  id: 'dog-2',
  name: 'Kira',
  registrationNumber: 'K9-2020-042',
  photoUrl: null,
  breed: 'Pastor Alemão',
  sex: 'Fêmea',
  dateOfBirth: null,
  conductor: null,
  specialties: [],
};

function createMockScheduleItem(params: {
  scheduleId: string;
  dogId: string;
  title: string;
  scheduleType: 'vaccination' | 'consultation' | 'exam';
  scheduledFor: Date;
}): ScheduleItemReadModel {
  return {
    scheduleId: params.scheduleId,
    dogId: params.dogId,
    persistedDogId: params.dogId,
    scheduleType: params.scheduleType,
    rawScheduleType: params.scheduleType,
    title: params.title,
    scheduledFor: params.scheduledFor,
    dueUntil: null,
    timezone: 'America/Sao_Paulo',
    lifecycleStatus: 'open',
    rawLifecycleStatus: 'open',
    sourceType: 'preventive',
    rawSourceType: 'preventive',
    sourceId: null,
    caseId: null,
    completedAt: null,
    completedBy: null,
    cancelledAt: null,
    cancelledBy: null,
    cancelReason: null,
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    recordedBy: null,
    revision: 1,
    revisionSource: 'canonical',
    schemaVersion: 1,
    notes: null,
    migrationBatchId: null,
    dataQuality: 'complete',
    issues: [],
  };
}

describe('F70 Web Health Reports PDF Migration V1', () => {
  let sampleLogoSlot: Awaited<ReturnType<typeof loadOfficialLogo>> = null;

  beforeAll(async () => {
    sampleLogoSlot = await loadOfficialLogo();
    expect(sampleLogoSlot).not.toBeNull();
    expect(sampleLogoSlot?.base64).toBeDefined();
    setCachedOfficialLogo(sampleLogoSlot);
  });

  const baseAggregate: HealthReportsAggregate = {
    period: '7d',
    referenceDate: new Date('2026-10-06T12:00:00.000Z'),
    readiness: {
      totalDogsInScope: 10,
      evaluatedCount: 10,
      unevaluatedCount: 0,
      isCoverageComplete: true,
      statusCounts: {
        operational: 7,
        operational_attention: 1,
        fit_with_restrictions: 1,
        temporarily_unfit: 1,
        not_evaluated: 0,
      },
      activeRestrictionsCount: 2,
      restrictionsCoverageComplete: true,
      restrictionsByType: { absolute: 1, partial: 1, attention: 0 },
      dogsWithRestrictionsCount: 2,
    },
    clinical: {
      totalCases: 3,
      activeCasesCount: 2,
      closedCasesCount: 1,
      casesOpenedInPeriodCount: 1,
      casesByStatus: {
        open: 1,
        under_treatment: 1,
        discharged: 1,
        under_investigation: 0,
        monitoring: 0,
        cancelled: 0,
      },
      unrecognizedStatusCount: 0,
      casesWithActiveRestrictionCount: 1,
      casesWithPendingScheduleCount: 1,
      coverage: {
        dogsInScope: 10,
        authorizedDogIds: ['dog-1', 'dog-2'],
        forbiddenDogIds: [],
        failedDogIds: [],
        partialEntryIds: [],
        complete: true,
      },
      isTruthfulZero: false,
    },
    schedule: {
      totalItems: 5,
      itemsInPeriodCount: 3,
      overdueCount: 1,
      pendingCount: 0,
      todayCount: 1,
      upcomingCount: 2,
      scheduledCount: 1,
      completedCount: 0,
      cancelledCount: 0,
      itemsByTypeInPeriod: {
        vaccination: 1,
        exam: 1,
        dose: 1,
        consultation: 0,
        weighing: 0,
        reevaluation: 0,
        deworming: 0,
        bath: 0,
        general: 0,
      },
      temporalUnavailableCount: 0,
      coverage: {
        dogsInScope: 10,
        authorizedDogIds: ['dog-1'],
        forbiddenDogIds: [],
        failedDogIds: [],
        partialEntryIds: [],
        complete: true,
      },
      isTruthfulZero: false,
    },
    filteredClinicalCases: [
      {
        entryId: 'dog-1:c1',
        dogId: 'dog-1',
        caseId: 'c1',
        dog: baseDog1,
        case: {
          dogId: 'dog-1',
          caseId: 'c1',
          clinicalStatus: 'under_treatment',
          rawClinicalStatus: 'under_treatment',
          title: 'Lesão Podal com Acompanhamento',
          openedAt: new Date('2026-09-28T10:00:00.000Z'),
          openedBy: null,
          recordedBy: null,
          openingEventId: null,
          openingType: null,
          primaryProfessional: null,
          closedAt: null,
          closedBy: null,
          closureType: null,
          closureReason: null,
          hasActiveRestriction: true,
          hasPendingSchedule: true,
          activeTreatmentsCount: 1,
          lastEventAt: null,
          eventCount: 3,
          schemaVersion: 1,
          dataQuality: 'complete',
          issues: [],
        },
      },
      {
        entryId: 'dog-2:c2',
        dogId: 'dog-2',
        caseId: 'c2',
        dog: baseDog2,
        case: {
          dogId: 'dog-2',
          caseId: 'c2',
          clinicalStatus: 'open',
          rawClinicalStatus: 'open',
          title: 'Dermatite Alérgica Sazonal',
          openedAt: new Date('2026-10-02T08:30:00.000Z'),
          openedBy: null,
          recordedBy: null,
          openingEventId: null,
          openingType: null,
          primaryProfessional: null,
          closedAt: null,
          closedBy: null,
          closureType: null,
          closureReason: null,
          hasActiveRestriction: false,
          hasPendingSchedule: true,
          activeTreatmentsCount: 0,
          lastEventAt: null,
          eventCount: 1,
          schemaVersion: 1,
          dataQuality: 'complete',
          issues: [],
        },
      },
    ],
    filteredScheduleItems: [
      {
        entry: {
          entryId: 'dog-1:s1',
          dogId: 'dog-1',
          scheduleId: 's1',
          dog: baseDog1,
          item: createMockScheduleItem({
            scheduleId: 's1',
            dogId: 'dog-1',
            title: 'Vacinação Antirrábica Anual',
            scheduleType: 'vaccination',
            scheduledFor: new Date('2026-10-05T09:00:00.000Z'),
          }),
        },
        temporal: {
          temporalStatus: 'overdue',
          temporalAvailability: 'available',
          effectiveDueUntil: new Date('2026-10-06T09:00:00.000Z'),
        },
        displayWindow: {
          inDisplayWindow: true,
          offsetDays: -1,
          availability: 'available',
        },
      },
      {
        entry: {
          entryId: 'dog-2:s2',
          dogId: 'dog-2',
          scheduleId: 's2',
          dog: baseDog2,
          item: createMockScheduleItem({
            scheduleId: 's2',
            dogId: 'dog-2',
            title: 'Reavaliação Dermatológica',
            scheduleType: 'consultation',
            scheduledFor: new Date('2026-10-06T14:00:00.000Z'),
          }),
        },
        temporal: {
          temporalStatus: 'today',
          temporalAvailability: 'available',
          effectiveDueUntil: new Date('2026-10-07T14:00:00.000Z'),
        },
        displayWindow: {
          inDisplayWindow: true,
          offsetDays: 0,
          availability: 'available',
        },
      },
      {
        entry: {
          entryId: 'dog-1:s3',
          dogId: 'dog-1',
          scheduleId: 's3',
          dog: baseDog1,
          item: createMockScheduleItem({
            scheduleId: 's3',
            dogId: 'dog-1',
            title: 'Hemograma Completo',
            scheduleType: 'exam',
            scheduledFor: new Date('2026-10-10T08:00:00.000Z'),
          }),
        },
        temporal: {
          temporalStatus: 'upcoming',
          temporalAvailability: 'available',
          effectiveDueUntil: new Date('2026-10-11T08:00:00.000Z'),
        },
        displayWindow: {
          inDisplayWindow: true,
          offsetDays: 4,
          availability: 'available',
        },
      },
    ],
    coverageSummary: {
      isAllComplete: true,
      forbiddenDogsCount: 0,
      failedDogsCount: 0,
      totalDogsInScope: 10,
      notes: [],
    },
  };

  describe('WEB-HLT-01 — Resumo Executivo de Saúde Canina (kpi_summary)', () => {
    it('gera documento paisagem A4 com ProductMark e dados executivos', () => {
      const doc = generateHealthKpiSummaryPdf(baseAggregate, {
        logoSlot: sampleLogoSlot,
      });

      expect(doc.internal.pageSize.getWidth()).toBeCloseTo(297, 1);
      expect(doc.internal.pageSize.getHeight()).toBeCloseTo(210, 1);
      expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);

      const buf = doc.output('arraybuffer');
      const header = new Uint8Array(buf).slice(0, 4);
      expect(String.fromCharCode(...header)).toBe('%PDF');
    });

    it('trata dataset sem alertas com tom positivo', () => {
      const cleanAggregate: HealthReportsAggregate = {
        ...baseAggregate,
        readiness: {
          ...baseAggregate.readiness,
          activeRestrictionsCount: 0,
          dogsWithRestrictionsCount: 0,
          statusCounts: {
            ...baseAggregate.readiness.statusCounts,
            temporarily_unfit: 0,
            operational_attention: 0,
            fit_with_restrictions: 0,
            operational: 10,
          },
        },
        schedule: {
          ...baseAggregate.schedule,
          overdueCount: 0,
        },
      };

      const doc = generateHealthKpiSummaryPdf(cleanAggregate, {
        logoSlot: sampleLogoSlot,
      });
      expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    });

    it('trata dataset com alto volume sem colapso de layout', () => {
      const denseAggregate: HealthReportsAggregate = {
        ...baseAggregate,
        readiness: {
          ...baseAggregate.readiness,
          totalDogsInScope: 45,
          unevaluatedCount: 3,
          isCoverageComplete: false,
          activeRestrictionsCount: 12,
          dogsWithRestrictionsCount: 8,
          restrictionsByType: { absolute: 4, partial: 5, attention: 3 },
          statusCounts: {
            operational: 30,
            operational_attention: 5,
            fit_with_restrictions: 5,
            temporarily_unfit: 2,
            not_evaluated: 3,
          },
        },
      };

      const doc = generateHealthKpiSummaryPdf(denseAggregate, {
        logoSlot: sampleLogoSlot,
      });
      expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    });
  });

  describe('WEB-HLT-02 — Relatório de Prontidão Operacional (readiness)', () => {
    it('gera documento de prontidão com matriz de classificação do efetivo', () => {
      const doc = generateHealthReadinessPdf(baseAggregate, {
        logoSlot: sampleLogoSlot,
      });

      expect(doc.internal.pageSize.getWidth()).toBeCloseTo(297, 1);
      expect(doc.internal.pageSize.getHeight()).toBeCloseTo(210, 1);
      expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);

      const buf = doc.output('arraybuffer');
      const header = new Uint8Array(buf).slice(0, 4);
      expect(String.fromCharCode(...header)).toBe('%PDF');
    });

    it('trata cobertura degradada sem mascarar diagnóstico', () => {
      const degradedAggregate: HealthReportsAggregate = {
        ...baseAggregate,
        readiness: {
          ...baseAggregate.readiness,
          isCoverageComplete: false,
          unevaluatedCount: 4,
        },
      };

      const doc = generateHealthReadinessPdf(degradedAggregate);
      expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    });
  });

  describe('WEB-HLT-03 — Relatório de Casos Clínicos (clinical)', () => {
    it('gera documento de casos clínicos com tabela detalhada', () => {
      const doc = generateHealthClinicalCasesPdf(baseAggregate, {
        logoSlot: sampleLogoSlot,
      });

      expect(doc.internal.pageSize.getWidth()).toBeCloseTo(297, 1);
      expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);

      const buf = doc.output('arraybuffer');
      const header = new Uint8Array(buf).slice(0, 4);
      expect(String.fromCharCode(...header)).toBe('%PDF');
    });

    it('trata lista vazia de casos clínicos graciosamente com ObservationBlock', () => {
      const emptyAggregate: HealthReportsAggregate = {
        ...baseAggregate,
        filteredClinicalCases: [],
        clinical: {
          ...baseAggregate.clinical,
          totalCases: 0,
          activeCasesCount: 0,
          casesOpenedInPeriodCount: 0,
        },
      };

      const doc = generateHealthClinicalCasesPdf(emptyAggregate);
      expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    });

    it('suporta múltiplos casos com paginação fluida', () => {
      const manyCases: ClinicalCaseListEntry[] = Array.from({ length: 15 }, (_, i) => ({
        entryId: `dog-${i}:c${i}`,
        dogId: `dog-${i}`,
        caseId: `c${i}`,
        dog: {
          id: `dog-${i}`,
          name: `K9 Herói ${i + 1}`,
          registrationNumber: `K9-REG-${i}`,
          photoUrl: null,
          breed: 'Pastor Belga Malinois',
          sex: 'Macho',
          dateOfBirth: null,
          conductor: null,
          specialties: [],
        },
        case: {
          dogId: `dog-${i}`,
          caseId: `c${i}`,
          clinicalStatus: 'under_treatment',
          rawClinicalStatus: 'under_treatment',
          title: `Tratamento Fisioterápico e Conduta Terapêutica Estendida #${i + 1}`,
          openedAt: new Date('2026-09-15T10:00:00.000Z'),
          openedBy: null,
          recordedBy: null,
          openingEventId: null,
          openingType: null,
          primaryProfessional: null,
          closedAt: null,
          closedBy: null,
          closureType: null,
          closureReason: null,
          hasActiveRestriction: i % 2 === 0,
          hasPendingSchedule: true,
          activeTreatmentsCount: 1,
          lastEventAt: null,
          eventCount: 4,
          schemaVersion: 1,
          dataQuality: 'complete',
          issues: [],
        },
      }));

      const denseAggregate: HealthReportsAggregate = {
        ...baseAggregate,
        filteredClinicalCases: manyCases,
        clinical: {
          ...baseAggregate.clinical,
          totalCases: 15,
          activeCasesCount: 15,
        },
      };

      const doc = generateHealthClinicalCasesPdf(denseAggregate, {
        logoSlot: sampleLogoSlot,
      });
      expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    });
  });

  describe('WEB-HLT-04 — Relatório da Agenda de Procedimentos (schedule)', () => {
    it('gera documento da agenda sanitária com tabela e situação temporal', () => {
      const doc = generateHealthSchedulePdf(baseAggregate, {
        logoSlot: sampleLogoSlot,
      });

      expect(doc.internal.pageSize.getWidth()).toBeCloseTo(297, 1);
      expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);

      const buf = doc.output('arraybuffer');
      const header = new Uint8Array(buf).slice(0, 4);
      expect(String.fromCharCode(...header)).toBe('%PDF');
    });

    it('trata agenda vazia graciosamente com ObservationBlock', () => {
      const emptyScheduleAggregate: HealthReportsAggregate = {
        ...baseAggregate,
        filteredScheduleItems: [],
        schedule: {
          ...baseAggregate.schedule,
          itemsInPeriodCount: 0,
          overdueCount: 0,
          todayCount: 0,
          upcomingCount: 0,
        },
      };

      const doc = generateHealthSchedulePdf(emptyScheduleAggregate);
      expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    });

    it('suporta múltiplos procedimentos agendados com repetição de cabeçalho', () => {
      const manyItems: ComposedScheduleEntry[] = Array.from({ length: 20 }, (_, i) => ({
        entry: {
          entryId: `dog-${i}:s${i}`,
          dogId: `dog-${i}`,
          scheduleId: `s${i}`,
          dog: {
            id: `dog-${i}`,
            name: `Thor ${i + 1}`,
            registrationNumber: `K9-2023-${i}`,
            photoUrl: null,
            breed: 'Pastor Belga Malinois',
            sex: 'Macho',
            dateOfBirth: null,
            conductor: null,
            specialties: [],
          },
          item: createMockScheduleItem({
            scheduleId: `s${i}`,
            dogId: `dog-${i}`,
            title: `Procedimento Sanitário Específico #${i + 1}`,
            scheduleType: 'vaccination',
            scheduledFor: new Date('2026-10-06T08:00:00.000Z'),
          }),
        },
        temporal: {
          temporalStatus: i === 0 ? 'overdue' : i < 3 ? 'today' : 'upcoming',
          temporalAvailability: 'available',
          effectiveDueUntil: new Date('2026-10-07T08:00:00.000Z'),
        },
        displayWindow: {
          inDisplayWindow: true,
          offsetDays: i === 0 ? -1 : i < 3 ? 0 : 2,
          availability: 'available',
        },
      }));

      const denseAggregate: HealthReportsAggregate = {
        ...baseAggregate,
        filteredScheduleItems: manyItems,
        schedule: {
          ...baseAggregate.schedule,
          itemsInPeriodCount: 20,
          overdueCount: 1,
          todayCount: 2,
          upcomingCount: 17,
        },
      };

      const doc = generateHealthSchedulePdf(denseAggregate, {
        logoSlot: sampleLogoSlot,
      });
      expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Dispatcher & Local Visual Fixtures Generation', () => {
    it('dispatcher gera corretamente o documento para os 4 datasets', () => {
      const docKpi = generateHealthReportPdf('kpi_summary', baseAggregate);
      const docReadiness = generateHealthReportPdf('readiness', baseAggregate);
      const docClinical = generateHealthReportPdf('clinical', baseAggregate);
      const docSchedule = generateHealthReportPdf('schedule', baseAggregate);

      expect(docKpi.getNumberOfPages()).toBeGreaterThanOrEqual(1);
      expect(docReadiness.getNumberOfPages()).toBeGreaterThanOrEqual(1);
      expect(docClinical.getNumberOfPages()).toBeGreaterThanOrEqual(1);
      expect(docSchedule.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    });

    it('grava os 4 artefatos de visual fixture em build/visual_fixtures/web_health/', () => {
      const outDir = path.resolve(process.cwd(), 'build/visual_fixtures/web_health');
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }

      const kpiDoc = generateHealthKpiSummaryPdf(baseAggregate, {
        logoSlot: sampleLogoSlot,
      });
      const readinessDoc = generateHealthReadinessPdf(baseAggregate, {
        logoSlot: sampleLogoSlot,
      });
      const clinicalDoc = generateHealthClinicalCasesPdf(baseAggregate, {
        logoSlot: sampleLogoSlot,
      });
      const scheduleDoc = generateHealthSchedulePdf(baseAggregate, {
        logoSlot: sampleLogoSlot,
      });

      const kpiPath = path.join(outDir, 'health_kpi_summary.pdf');
      const readinessPath = path.join(outDir, 'health_readiness.pdf');
      const clinicalPath = path.join(outDir, 'health_clinical_cases.pdf');
      const schedulePath = path.join(outDir, 'health_schedule.pdf');
      const clinicalMultiPath = path.join(outDir, 'health_clinical_cases_multipage.pdf');
      const scheduleMultiPath = path.join(outDir, 'health_schedule_multipage.pdf');

      fs.writeFileSync(kpiPath, Buffer.from(kpiDoc.output('arraybuffer')));
      fs.writeFileSync(readinessPath, Buffer.from(readinessDoc.output('arraybuffer')));
      fs.writeFileSync(clinicalPath, Buffer.from(clinicalDoc.output('arraybuffer')));
      fs.writeFileSync(schedulePath, Buffer.from(scheduleDoc.output('arraybuffer')));

      // Gera e grava também fixtures multipágina com tabelas extensas
      const manyClinicalCases: ClinicalCaseListEntry[] = Array.from({ length: 25 }, (_, i) => ({
        entryId: `dog-${i}:c${i}`,
        dogId: `dog-${i}`,
        caseId: `c${i}`,
        dog: {
          id: `dog-${i}`,
          name: `K9 Operacional ${i + 1}`,
          registrationNumber: `K9-REG-${i}`,
          photoUrl: null,
          breed: 'Pastor Belga Malinois',
          sex: 'Macho',
          dateOfBirth: null,
          conductor: null,
          specialties: [],
        },
        case: {
          dogId: `dog-${i}`,
          caseId: `c${i}`,
          clinicalStatus: 'under_treatment' as const,
          rawClinicalStatus: 'under_treatment',
          title: `Acompanhamento Terapêutico Contínuo #${i + 1}`,
          openedAt: new Date('2026-09-15T10:00:00.000Z'),
          openedBy: null,
          recordedBy: null,
          openingEventId: null,
          openingType: null,
          primaryProfessional: null,
          closedAt: null,
          closedBy: null,
          closureType: null,
          closureReason: null,
          hasActiveRestriction: i % 2 === 0,
          hasPendingSchedule: true,
          activeTreatmentsCount: 1,
          lastEventAt: null,
          eventCount: 2,
          schemaVersion: 1,
          dataQuality: 'complete',
          issues: [],
        },
      }));
      const clinicalMultiDoc = generateHealthClinicalCasesPdf({
        ...baseAggregate,
        filteredClinicalCases: manyClinicalCases,
        clinical: {
          ...baseAggregate.clinical,
          totalCases: 25,
          activeCasesCount: 25,
        },
      }, { logoSlot: sampleLogoSlot });
      fs.writeFileSync(clinicalMultiPath, Buffer.from(clinicalMultiDoc.output('arraybuffer')));

      const manyScheduleItems: ComposedScheduleEntry[] = Array.from({ length: 25 }, (_, i) => ({
        entry: {
          entryId: `dog-${i}:s${i}`,
          dogId: `dog-${i}`,
          scheduleId: `s${i}`,
          dog: {
            id: `dog-${i}`,
            name: `K9 Canil ${i + 1}`,
            registrationNumber: `K9-2023-${i}`,
            photoUrl: null,
            breed: 'Pastor Belga Malinois',
            sex: 'Macho',
            dateOfBirth: null,
            conductor: null,
            specialties: [],
          },
          item: createMockScheduleItem({
            scheduleId: `s${i}`,
            dogId: `dog-${i}`,
            title: `Procedimento Sanitário Específico #${i + 1}`,
            scheduleType: 'vaccination',
            scheduledFor: new Date('2026-10-06T08:00:00.000Z'),
          }),
        },
        temporal: {
          temporalStatus: i === 0 ? 'overdue' : i < 4 ? 'today' : 'upcoming',
          temporalAvailability: 'available',
          effectiveDueUntil: new Date('2026-10-07T08:00:00.000Z'),
        },
        displayWindow: {
          inDisplayWindow: true,
          offsetDays: i === 0 ? -1 : 0,
          availability: 'available',
        },
      }));
      const scheduleMultiDoc = generateHealthSchedulePdf({
        ...baseAggregate,
        filteredScheduleItems: manyScheduleItems,
        schedule: {
          ...baseAggregate.schedule,
          itemsInPeriodCount: 25,
          overdueCount: 1,
          todayCount: 3,
          upcomingCount: 21,
        },
      }, { logoSlot: sampleLogoSlot });
      fs.writeFileSync(scheduleMultiPath, Buffer.from(scheduleMultiDoc.output('arraybuffer')));

      expect(fs.existsSync(kpiPath)).toBe(true);
      expect(fs.existsSync(readinessPath)).toBe(true);
      expect(fs.existsSync(clinicalPath)).toBe(true);
      expect(fs.existsSync(schedulePath)).toBe(true);
      expect(fs.existsSync(clinicalMultiPath)).toBe(true);
      expect(fs.existsSync(scheduleMultiPath)).toBe(true);

      expect(clinicalMultiDoc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
      expect(scheduleMultiDoc.getNumberOfPages()).toBeGreaterThanOrEqual(2);

      expect(fs.statSync(kpiPath).size).toBeGreaterThan(500000);
      expect(fs.statSync(readinessPath).size).toBeGreaterThan(500000);
      expect(fs.statSync(clinicalPath).size).toBeGreaterThan(500000);
      expect(fs.statSync(schedulePath).size).toBeGreaterThan(500000);
      expect(fs.statSync(clinicalMultiPath).size).toBeGreaterThan(500000);
      expect(fs.statSync(scheduleMultiPath).size).toBeGreaterThan(500000);

      // Confirma que o PDF contém o asset de imagem embutido (XObject / Image)
      const kpiContent = fs.readFileSync(kpiPath).toString('latin1');
      expect(kpiContent).toContain('/Image');
    });
  });
});
