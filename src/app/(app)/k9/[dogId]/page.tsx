"use client";

import { ArrowLeft, Dog } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

import { useAccessControl } from "@/features/access/providers/access-control-provider";
import { DataState } from "@/features/effective/components/effective-ui";
import { K9ProfileDocuments } from "@/features/effective/components/k9-profile-v1/k9-profile-documents";
import { K9ProfileHealthTab } from "@/features/effective/components/k9-profile-v1/k9-profile-health-tab";
import { K9ProfileHero } from "@/features/effective/components/k9-profile-v1/k9-profile-hero";
import { K9ProfileHistory } from "@/features/effective/components/k9-profile-v1/k9-profile-history";
import { K9ProfileOverview } from "@/features/effective/components/k9-profile-v1/k9-profile-overview";
import {
  K9ProfileTabPanel,
  K9ProfileTabs,
  type K9ProfileTab,
} from "@/features/effective/components/k9-profile-v1/k9-profile-tabs";
import { K9ProfileTraining } from "@/features/effective/components/k9-profile-v1/k9-profile-training";
import {
  ageInYears,
  specialtyLabel,
  type EffectiveDog,
  type K9Specialty,
} from "@/features/effective/hooks/use-effective-data";
import { useK9ProfileContext } from "@/features/effective/hooks/use-k9-profile-context";
import {
  profileText,
  useK9ProfileData,
  type ProfileRecord,
} from "@/features/effective/hooks/use-k9-profile-data";
import {
  buildK9Activity,
  sortByRecordDateDesc,
} from "@/features/effective/lib/k9-profile-activity";
import { paths } from "@/lib/routes/paths";

function profileDateValue(record: ProfileRecord | null, keys: string[]) {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (value instanceof Date) return value;
    if (typeof value === "string" || typeof value === "number") {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    if (value && typeof value === "object" && "toDate" in value) {
      const toDate = (value as { toDate?: unknown }).toDate;
      if (typeof toDate === "function") {
        const parsed = toDate.call(value);
        if (parsed instanceof Date && !Number.isNaN(parsed.getTime())) {
          return parsed;
        }
      }
    }
  }
  return null;
}

/**
 * Perfil K9 V1.
 *
 * O Perfil agrega e contextualiza; ele não recalcula domínio de especialista:
 *
 *   situação operacional  → `classifyK9()`, o mesmo classifier do Roster
 *   prontidão clínica     → `health_summary/current` (fonte Health)
 *   vacinação / peso      → `useHealthData()`, outputs do módulo Saúde
 *   binômio / turno       → `binomials` + `active_shifts`, padrão do Drawer
 *
 * Cada aba secundária carrega quando ativa, e cada domínio degrada por conta
 * própria: uma fonte indisponível informa a própria ausência sem derrubar a
 * página.
 */
export default function K9ProfilePage() {
  const { can } = useAccessControl();
  const params = useParams<{ dogId: string }>();
  const dogId = decodeURIComponent(params.dogId ?? "");
  const data = useK9ProfileData(dogId);
  const [activeTab, setActiveTab] = useState<K9ProfileTab>("overview");

  // O hero e a classificação falam a mesma língua do Roster, então o registro
  // cru de `dogs` é adaptado para o mesmo contrato `EffectiveDog`.
  const dog = useMemo<EffectiveDog | null>(() => {
    if (!data.dog) return null;
    const record = data.dog;
    const specialties: K9Specialty[] = data.specialties.map((specialty) => ({
      id: specialty._id,
      status: profileText(specialty, ["status", "state"]) ?? "",
      type: profileText(specialty, ["type", "modality", "name"]) ?? specialty._id,
    }));

    return {
      breed: profileText(record, ["breed", "raça", "raca"]),
      color: profileText(record, ["cor", "color"]),
      conductorRa: profileText(record, [
        "conductorRa",
        "conductor_ra",
        "handlerId",
        "handler_id",
      ]),
      dateOfBirth: profileDateValue(record, ["dateOfBirth", "date_of_birth"]),
      id: record._id,
      microchip: profileText(record, ["microchip"]),
      name: profileText(record, ["name", "nome"]) ?? "K9 sem nome",
      profileImageUrl: profileText(record, [
        "profileImageUrl",
        "profile_image_url",
        "photoUrl",
        "image_url",
      ]),
      registrationNumber: profileText(record, [
        "matrícula",
        "matricula",
        "registrationNumber",
        "registration_number",
        "rga",
      ]),
      sex: profileText(record, ["sex", "sexo"]),
      specialties,
      // Status administrativo cru: nenhum fallback para "Ativo".
      status: profileText(record, ["status", "situação", "situacao"]) ?? "",
    };
  }, [data.dog, data.specialties]);

  const { binomialContext, detail, error: contextError, status } =
    useK9ProfileContext(dog);

  const sessions = useMemo(
    () => sortByRecordDateDesc(data.trainingSessions),
    [data.trainingSessions],
  );
  const healthEvents = useMemo(
    () => sortByRecordDateDesc(data.healthEvents),
    [data.healthEvents],
  );
  const documents = useMemo(
    () => sortByRecordDateDesc(data.documents),
    [data.documents],
  );

  const activity = useMemo(
    () =>
      buildK9Activity({
        documents: data.documents,
        healthEvents: data.healthEvents,
        occurrences: data.occurrences,
        sessions: data.trainingSessions,
        weights: data.weightRecords,
      }),
    [
      data.documents,
      data.healthEvents,
      data.occurrences,
      data.trainingSessions,
      data.weightRecords,
    ],
  );

  if (data.loading && !data.dog) {
    return <DataState error={null} loading noun="o perfil do K9" />;
  }

  if (data.error && !data.dog) {
    return <DataState error={data.error} loading={false} noun="o perfil do K9" />;
  }

  if (!dog) {
    return (
      <div className="space-y-5">
        <Link
          className="inline-flex items-center gap-2 text-sm font-bold text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
          href={paths.k9}
        >
          <ArrowLeft aria-hidden className="h-4 w-4" />
          Voltar ao efetivo K9
        </Link>
        <div className="rounded-3xl border border-dashed border-white/10 p-12 text-center">
          <Dog aria-hidden className="mx-auto h-12 w-12 text-slate-600" />
          <h1 className="mt-4 text-xl font-black text-white">
            K9 não localizado
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            O documento dogs/{dogId} não existe ou não está acessível.
          </p>
        </div>
      </div>
    );
  }

  const specialtyLabels = dog.specialties.map((item) =>
    specialtyLabel(item.type),
  );
  const size = profileText(data.dog, ["porte", "size"]);

  return (
    <div className="space-y-4">
      <Link
        className="inline-flex items-center gap-2 text-xs font-bold text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
        href={paths.k9}
      >
        <ArrowLeft aria-hidden className="h-4 w-4" />
        Voltar ao efetivo K9
      </Link>

      <K9ProfileHero
        ageYears={ageInYears(dog.dateOfBirth)}
        binomialContext={binomialContext}
        canEdit={can("k9", "edit")}
        dog={dog}
        editHref={`${paths.k9}/${encodeURIComponent(dog.id)}/edit`}
        specialtyLabels={specialtyLabels}
        status={status}
      />

      <div className="rounded-3xl border border-cyan-200/12 bg-[#081320]/60 p-4 sm:p-5">
        <K9ProfileTabs activeTab={activeTab} onChange={setActiveTab} />

        <div className="mt-4">
          {activeTab === "overview" ? (
            <K9ProfileTabPanel tab="overview">
              <K9ProfileOverview
                activity={activity}
                detail={detail}
                dog={dog}
                onSeeAllActivity={() => setActiveTab("history")}
                onSeeHealth={() => setActiveTab("health")}
                size={size}
                status={status}
              />
            </K9ProfileTabPanel>
          ) : null}

          {/* Cada aba abaixo só monta quando ativa: nenhuma query pesada no
              primeiro render do Perfil. */}
          {activeTab === "training" ? (
            <K9ProfileTabPanel tab="training">
              <K9ProfileTraining
                detail={detail}
                dogId={dog.id}
                error={data.error}
                loading={data.loading}
                sessions={sessions}
                specialties={data.specialties}
              />
            </K9ProfileTabPanel>
          ) : null}

          {activeTab === "health" ? (
            <K9ProfileTabPanel tab="health">
              <K9ProfileHealthTab
                dogId={dog.id}
                events={healthEvents}
                status={status}
              />
            </K9ProfileTabPanel>
          ) : null}

          {activeTab === "history" ? (
            <K9ProfileTabPanel tab="history">
              <K9ProfileHistory
                activity={activity}
                error={data.error}
                loading={data.loading}
              />
            </K9ProfileTabPanel>
          ) : null}

          {activeTab === "documents" ? (
            <K9ProfileTabPanel tab="documents">
              <K9ProfileDocuments
                documents={documents}
                error={data.error}
                loading={data.loading}
              />
            </K9ProfileTabPanel>
          ) : null}
        </div>
      </div>

      {/* Erro de fonte secundária (binômio/turno) é informado sem derrubar o
          perfil base. */}
      {contextError ? (
        <p
          className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-3 text-xs text-amber-200/85"
          role="status"
        >
          Algumas informações complementares não puderam ser carregadas:{" "}
          {contextError}
        </p>
      ) : null}
    </div>
  );
}
