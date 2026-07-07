"use client";

import {
  Clock3,
  FileSignature,
  GraduationCap,
  ListChecks,
} from "lucide-react";
import {
  collection,
  collectionGroup,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/features/auth/providers/auth-provider";
import {
  subscribeShiftAssignments,
  subscribeShiftGroups,
  type ShiftAssignment as ShiftAssignmentType,
  type ShiftGroup as ShiftGroupType,
} from "@/features/effective/data/shift-group-service";
import {
  useDashboardPeriod,
  type DashboardPeriodDays,
} from "@/features/dashboard/providers/dashboard-period-provider";
import { db } from "@/lib/firebase/client";
import {
  useShiftPayload,
  useCrewPayload,
} from "@/features/dashboard/hooks/use-service-day-data";
import { useCrewMembers } from "@/features/dashboard/hooks/use-crew-members";

import { DashboardHeader } from "@/features/dashboard/components/dashboard-header";
import { DashboardMetrics } from "@/features/dashboard/components/dashboard-metrics";
import { DashboardOccurrences } from "@/features/dashboard/components/dashboard-occurrences";
import { DashboardPending } from "@/features/dashboard/components/dashboard-pending";
import { DashboardHealth } from "@/features/dashboard/components/dashboard-health";
import { DashboardDrugs } from "@/features/dashboard/components/dashboard-drugs";
import { DashboardCharts } from "@/features/dashboard/components/dashboard-charts";
import {
  PlantaoCard,
  EquipeCard,
} from "@/features/dashboard/components/dashboard-service-day-cards";

import {
  dashboardCollectionPaths,
  emptyDashboardCollection,
  createDashboardCollections,
  drugTiles,
  emptyDrugStats,
  drugEntriesFromOccurrence,
  drugCategory,
  entryWeightGrams,
  formatCount,
  visibleRecords,
  occurrenceDate,
  periodStart,
  isActiveRecord,
  dogIdentity,
  detectUserProfile,
  computeHealthMetrics,
  computeSummaryCards,
  computeOccurrenceMetrics,
  computeIntegrityMetrics,
  computePendingMetrics,
} from "@/features/dashboard/components/dashboard-utils";

import type {
  DashboardCollectionState,
  DashboardCollections,
  DashboardRecord,
  DrugCategory,
  DrugStats,
  DogHealthStatus,
  UserProfile,
  SummaryCardData,
  OccurrenceMetrics,
  PendingMetrics,
  HealthMetrics,
  IntegrityMetrics,
} from "@/features/dashboard/components/dashboard-types";

import type { PendingItem } from "@/features/dashboard/components/dashboard-pending";

/* ─── Dashboard entry animation delays ─── */
const STAGGER = 0.06; // 60ms between sections
const ENTRY_DURATION = 0.3; // hud-entry

function sectionVariant(delay: number) {
  return {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: ENTRY_DURATION,
      ease: [0.215, 0.61, 0.355, 1] as const,
      delay,
    },
  };
}

function staggerContainer() {
  return {
    animate: {
      transition: {
        staggerChildren: STAGGER,
      },
    },
  };
}

function cardVariant() {
  return {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: ENTRY_DURATION,
      ease: [0.215, 0.61, 0.355, 1] as const,
    },
  };
}

export default function DashboardPage() {
  const prefersReducedMotion = useReducedMotion();
  const { profile } = useAuth();
  const { periodDays, periodLabel } = useDashboardPeriod();
  const warName = profile?.displayName?.trim() || "Operador";
  const userProfile = detectUserProfile({
    isK9Instructor: profile?.isK9Instructor,
    roles: profile?.roles,
    claims: profile?.claims,
  });
  const [occurrences, setOccurrences] = useState<DashboardCollectionState>(
    () => emptyDashboardCollection(),
  );
  const [notifications, setNotifications] = useState<DashboardCollectionState>(
    () => emptyDashboardCollection(),
  );
  const [promotionRequests, setPromotionRequests] =
    useState<DashboardCollectionState>(() => emptyDashboardCollection());
  const [healthEvents, setHealthEvents] = useState<DashboardCollectionState>(
    () => emptyDashboardCollection(),
  );
  const [weightRecords, setWeightRecords] =
    useState<DashboardCollectionState>(() => emptyDashboardCollection());
  const [dashboardCollections, setDashboardCollections] =
    useState<DashboardCollections>(() => createDashboardCollections());
  const [shiftGroups, setShiftGroups] = useState<ShiftGroupType[]>([]);
  const [shiftAssignments, setShiftAssignments] = useState<ShiftAssignmentType[]>([]);

  useEffect(() => {
    const unsubscribes = dashboardCollectionPaths.map(({ key, path }) =>
      onSnapshot(
        collection(db, path),
        (snapshot) => {
          const records = snapshot.docs.map((documentSnapshot) => ({
            ...documentSnapshot.data(),
            _id: documentSnapshot.id,
          }));
          setDashboardCollections((current) => ({
            ...current,
            [key]: { error: null, loading: false, records },
          }));
        },
        (error) => {
          setDashboardCollections((current) => ({
            ...current,
            [key]: { ...current[key as keyof DashboardCollections], error: error.message, loading: false },
          }));
        },
      ),
    );
    return () => { for (const unsub of unsubscribes) unsub(); };
  }, []);

  useEffect(() => {
    const thirtyOneDaysAgo = new Date();
    thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);
    const cutoff = Timestamp.fromDate(thirtyOneDaysAgo);
    const occurrencesQuery = query(
      collection(db, "occurrences"),
      where("started_at", ">=", cutoff),
      orderBy("started_at", "desc"),
      limit(500),
    );
    return onSnapshot(
      occurrencesQuery,
      (snapshot) => {
        setOccurrences({ error: null, loading: false, records: snapshot.docs.map((d) => ({ ...d.data(), _id: d.id })) });
      },
      (error) => {
        setOccurrences({ error: error.message, loading: false, records: [] });
      },
    );
  }, []);

  useEffect(() => {
    const unsubGroups = subscribeShiftGroups((groups) => setShiftGroups(groups));
    const unsubAssignments = subscribeShiftAssignments((assignments) => setShiftAssignments(assignments));
    return () => { unsubGroups(); unsubAssignments(); };
  }, []);

  useEffect(() => {
    if (dashboardCollections.dogs.loading) return;
    const activeDogs = visibleRecords(dashboardCollections.dogs.records).filter(isActiveRecord);
    const dogIdSet = new Set(activeDogs.map(dogIdentity).filter(Boolean));
    if (dogIdSet.size === 0) {
      // Use microtask to avoid synchronous setState in effect body
      queueMicrotask(() => {
        setHealthEvents({ error: null, loading: false, records: [] });
        setWeightRecords({ error: null, loading: false, records: [] });
      });
      return;
    }
    const healthByDog = new Map<string, DashboardRecord[]>();
    const weightsByDog = new Map<string, DashboardRecord[]>();
    let healthError: string | null = null;
    let weightError: string | null = null;
    function updateHealth() {
      const records: DashboardRecord[] = [];
      for (const entries of healthByDog.values()) records.push(...entries);
      setHealthEvents({ error: healthError, loading: false, records });
    }
    function updateWeight() {
      const records: DashboardRecord[] = [];
      for (const entries of weightsByDog.values()) records.push(...entries);
      setWeightRecords({ error: weightError, loading: false, records });
    }
    const unsubHealth = onSnapshot(
      collectionGroup(db, "health_events"),
      (snapshot) => {
        healthByDog.clear();
        for (const docSnap of snapshot.docs) {
          const dogId = dogIdentity(docSnap.data());
          if (dogId && dogIdSet.has(dogId)) {
            healthByDog.set(dogId, [...(healthByDog.get(dogId) ?? []), { ...docSnap.data(), _dogId: dogId, _id: docSnap.id }]);
          }
        }
        healthError = null;
        updateHealth();
      },
      (error) => { healthError = error.message; updateHealth(); },
    );
    const unsubWeight = onSnapshot(
      collectionGroup(db, "weight_records"),
      (snapshot) => {
        weightsByDog.clear();
        for (const docSnap of snapshot.docs) {
          const dogId = dogIdentity(docSnap.data());
          if (dogId && dogIdSet.has(dogId)) {
            weightsByDog.set(dogId, [...(weightsByDog.get(dogId) ?? []), { ...docSnap.data(), _dogId: dogId, _id: docSnap.id }]);
          }
        }
        weightError = null;
        updateWeight();
      },
      (error) => { weightError = error.message; updateWeight(); },
    );
    return () => { unsubHealth(); unsubWeight(); };
  }, [dashboardCollections.dogs.loading, dashboardCollections.dogs.records]);

  useEffect(() => {
    const ra = profile?.ra?.trim();
    if (!ra) return;
    return onSnapshot(
      collection(db, "notifications", ra, "items"),
      (snapshot) => { setNotifications({ error: null, loading: false, records: snapshot.docs.map((d) => ({ ...d.data(), _id: d.id })) }); },
      (error) => { setNotifications({ error: error.message, loading: false, records: [] }); },
    );
  }, [profile?.ra]);

  useEffect(() => {
    const ra = profile?.ra?.trim();
    if (!ra) return;
    const requestsQuery = profile?.isK9Instructor
      ? collection(db, "promotion_requests")
      : query(collection(db, "promotion_requests"), where("requester_ra", "==", ra));
    return onSnapshot(
      requestsQuery,
      (snapshot) => { setPromotionRequests({ error: null, loading: false, records: snapshot.docs.map((d) => ({ ...d.data(), _id: d.id })) }); },
      (error) => { setPromotionRequests({ error: error.message, loading: false, records: [] }); },
    );
  }, [profile?.isK9Instructor, profile?.ra]);

  const periodOccurrences = useMemo(() => {
    const start = periodStart(periodDays);
    return visibleRecords(occurrences.records).filter((record) => {
      const date = occurrenceDate(record);
      return date != null && date >= start;
    });
  }, [occurrences.records, periodDays]);

  const drugStats = useMemo(() => {
    const nextStats: DrugStats = { ...emptyDrugStats };
    for (const occurrence of periodOccurrences) {
      for (const entry of drugEntriesFromOccurrence(occurrence)) {
        const type = entry.type ?? entry.tipo ?? entry.name ?? entry.nome;
        const category = drugCategory(type);
        nextStats[category] += entryWeightGrams(entry);
      }
    }
    return nextStats;
  }, [periodOccurrences]);

  const totalDrugGrams = useMemo(() => Object.values(drugStats).reduce((s, g) => s + g, 0), [drugStats]);
  const activeDrugCategories = useMemo(() => (Object.keys(drugStats) as DrugCategory[]).filter((c) => drugStats[c] > 0), [drugStats]);
  const visibleDrugTiles = useMemo(() => activeDrugCategories.length > 0 ? drugTiles.filter((t) => activeDrugCategories.includes(t.category as DrugCategory)) : [], [activeDrugCategories]);
  const isLoadingDrugs = occurrences.loading;
  const drugStatsError = occurrences.error;

  const occurrenceMetrics = useMemo(() => computeOccurrenceMetrics(occurrences.records, periodOccurrences), [occurrences.records, periodOccurrences]);
  const pendingMetrics = useMemo(() => computePendingMetrics(occurrences.records, notifications.records, promotionRequests.records), [notifications.records, occurrences.records, promotionRequests.records]);
  const integrityMetrics = useMemo(() => computeIntegrityMetrics(occurrences.records), [occurrences.records]);
  const healthMetrics = useMemo(() => computeHealthMetrics(dashboardCollections.dogs.records, healthEvents.records, weightRecords.records, periodDays), [dashboardCollections.dogs.records, healthEvents.records, periodDays, weightRecords.records]);
  const summaryCards = useMemo(() => computeSummaryCards(dashboardCollections), [dashboardCollections]);

  const healthLoading = dashboardCollections.dogs.loading || healthEvents.loading || weightRecords.loading;
  const healthError = dashboardCollections.dogs.error ?? healthEvents.error ?? weightRecords.error;
  const readinessPercent = healthMetrics.total > 0 ? Math.round((healthMetrics.ready / healthMetrics.total) * 100) : 0;

  const shiftPayload = useShiftPayload({
    shiftGroups,
    shiftAssignments,
    users: dashboardCollections.users,
  });

  const crewMembers = useCrewMembers(dashboardCollections.vehicleCrews.records);

  const crewPayload = useCrewPayload({
    vehicleCrews: dashboardCollections.vehicleCrews,
    activeShifts: dashboardCollections.activeShifts,
    dogs: dashboardCollections.dogs,
    users: dashboardCollections.users,
    crewMembers,
  });

  const pendingItems: PendingItem[] = [
    { label: "Aguardando assinaturas", value: pendingMetrics.awaitingSignatureOccurrences, detail: "ocorrencias em rodada de assinatura", iconSrc: "/assets/icones/pend_assinaturas.png", fallback: FileSignature, fallbackTone: "amber", tone: "amber", loading: occurrences.loading, error: occurrences.error },
    { label: "Em finalizacao", value: pendingMetrics.finalizingOccurrences, detail: pendingMetrics.finalizedWithPending > 0 ? `${formatCount(pendingMetrics.finalizedWithPending)} finalizada(s) com pendencia` : "rascunhos ainda nao selados", iconSrc: "/assets/icones/pend_finalizacao.png", fallback: Clock3, fallbackTone: "blue", tone: "blue", loading: occurrences.loading, error: occurrences.error },
    { label: "Minhas acoes", value: pendingMetrics.personalActions, detail: "convites, assinaturas e avaliacoes", iconSrc: "/assets/icones/pend_acoes.png", fallback: ListChecks, fallbackTone: "red", tone: "red", loading: notifications.loading, error: notifications.error },
    { label: profile?.isK9Instructor ? "Evolucoes para avaliar" : "Minhas evolucoes pendentes", value: pendingMetrics.pendingPromotions, detail: profile?.isK9Instructor ? "solicitacoes aguardando instrutor" : "solicitacoes aguardando decisao", iconSrc: "/assets/icones/pend_evolucoes.png", fallback: GraduationCap, fallbackTone: "violet", tone: "violet", loading: promotionRequests.loading, error: promotionRequests.error },
  ];

  const reduced = prefersReducedMotion ?? false;

  return (
    <div className="space-y-5">
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduced ? { duration: 0 } : { duration: ENTRY_DURATION, ease: [0.215, 0.61, 0.355, 1] as const }}
      >
        <DashboardHeader
          warName={warName}
          userProfile={userProfile}
        />
      </motion.div>

      <motion.div
        initial={reduced ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduced ? { duration: 0 } : { duration: ENTRY_DURATION, ease: [0.215, 0.61, 0.355, 1] as const, delay: STAGGER }}
      >
        <DashboardMetrics cards={summaryCards} />
      </motion.div>

      <motion.div
        initial={reduced ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduced ? { duration: 0 } : { duration: ENTRY_DURATION, ease: [0.215, 0.61, 0.355, 1] as const, delay: STAGGER * 2 }}
      >
        <div className="grid gap-5 xl:grid-cols-2">
          <PlantaoCard shifts={shiftPayload} />
          <EquipeCard crew={crewPayload} />
        </div>
      </motion.div>

      <motion.div
        initial={reduced ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduced ? { duration: 0 } : { duration: ENTRY_DURATION, ease: [0.215, 0.61, 0.355, 1] as const, delay: STAGGER * 3 }}
      >
        <section className="grid items-stretch gap-4 2xl:grid-cols-[1.25fr_0.75fr]">
          <DashboardOccurrences
            metrics={occurrenceMetrics}
            periodDays={periodDays}
            periodLabel={periodLabel}
            loading={occurrences.loading}
            error={occurrences.error}
            records={occurrences.records}
          />
          <DashboardPending items={pendingItems} />
        </section>
      </motion.div>

      <motion.div
        initial={reduced ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduced ? { duration: 0 } : { duration: ENTRY_DURATION, ease: [0.215, 0.61, 0.355, 1] as const, delay: STAGGER * 4 }}
      >
        <DashboardHealth
          healthMetrics={healthMetrics}
          healthLoading={healthLoading}
          healthError={healthError}
          readinessPercent={readinessPercent}
          periodLabel={periodLabel}
        />
      </motion.div>

      <motion.div
        initial={reduced ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduced ? { duration: 0 } : { duration: ENTRY_DURATION, ease: [0.215, 0.61, 0.355, 1] as const, delay: STAGGER * 5 }}
      >
        <DashboardDrugs
          drugStats={drugStats}
          totalDrugGrams={totalDrugGrams}
          activeDrugCategories={activeDrugCategories.length}
          visibleDrugTiles={visibleDrugTiles}
          isLoadingDrugs={isLoadingDrugs}
          drugStatsError={drugStatsError}
        />
      </motion.div>

      <motion.div
        initial={reduced ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduced ? { duration: 0 } : { duration: ENTRY_DURATION, ease: [0.215, 0.61, 0.355, 1] as const, delay: STAGGER * 6 }}
      >
        <DashboardCharts
          userProfile={userProfile}
          integrityMetrics={integrityMetrics}
          occurrenceMetrics={occurrenceMetrics}
          readinessPercent={readinessPercent}
          loading={occurrences.loading}
          error={occurrences.error}
        />
      </motion.div>
    </div>
  );
}
