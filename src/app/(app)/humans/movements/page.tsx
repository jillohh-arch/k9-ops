"use client";

import {
  Activity,
  ArrowRightLeft,
  CalendarCheck,
  Clock3,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

import { useAccessControl } from "@/features/access/providers/access-control-provider";
import { HumanMovementDialog } from "@/features/effective/components/human-record-dialogs";
import {
  DataState,
  EffectiveHeader,
  StatusPill,
  SummaryCard,
} from "@/features/effective/components/effective-ui";
import { archiveHumanMovement } from "@/features/effective/data/human-admin-service";
import {
  humanText,
  useHumanAdministrativeRecords,
} from "@/features/effective/hooks/use-human-profile-data";

function normalize(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function movementTone(status: string | null) {
  const key = normalize(status);
  if (key.includes("conclu")) return "green" as const;
  if (key.includes("pendente")) return "amber" as const;
  if (key.includes("cancel")) return "violet" as const;
  return "blue" as const;
}

export default function HumanMovementsPage() {
  const { can } = useAccessControl();
  const data = useHumanAdministrativeRecords();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [dialog, setDialog] = useState(false);
  const users = useMemo(
    () =>
      data.users.map((user) => ({
        label: `${humanText(user, "callsign", "nomeCompleto", "name") ?? user._id} - RA ${user._id}`,
        value: user._id,
      })),
    [data.users],
  );
  const visible = useMemo(() => {
    const needle = normalize(search);
    return data.movements.filter((record) => {
      const recordStatus = humanText(record, "status") ?? "";
      return (
        humanText(record, "entity_type") === "human" &&
        (status === "all" || normalize(recordStatus) === status) &&
        (!needle ||
          [
            humanText(
              record,
              "entity_name",
              "entity_id",
              "movement_type",
              "reason",
              "destination_unit",
            ),
          ].some((value) => normalize(value).includes(needle)))
      );
    });
  }, [data.movements, search, status]);
  const active = data.movements.filter(
    (record) => normalize(humanText(record, "status")).includes("andamento"),
  ).length;
  const pending = data.movements.filter(
    (record) => normalize(humanText(record, "status")).includes("pendente"),
  ).length;
  const completed = data.movements.filter(
    (record) => normalize(humanText(record, "status")).includes("conclu"),
  ).length;
  const canEditHuman = can("humans", "edit");

  async function archive(id: string) {
    if (!canEditHuman) return;
    const reason = window.prompt("Motivo do arquivamento:");
    if (!reason || reason.trim().length < 5) return;
    await archiveHumanMovement(id, reason.trim());
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <EffectiveHeader
          description="Afastamentos, licencas, transferencias e retornos do efetivo humano."
          title="Movimentações do efetivo"
        />
        {canEditHuman ? (
          <button
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 shadow-[0_0_24px_rgba(77,208,225,0.24)] hover:bg-cyan-200"
            onClick={() => setDialog(true)}
            type="button"
          >
            <Plus className="h-4 w-4" /> Nova movimentação
          </button>
        ) : null}
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          detail="registros preservados"
          icon={ArrowRightLeft}
          label="Total"
          tone="cyan"
          value={String(data.movements.length)}
        />
        <SummaryCard
          detail="requerem acompanhamento"
          icon={Activity}
          label="Em andamento"
          tone="blue"
          value={String(active)}
        />
        <SummaryCard
          detail="aguardando providencias"
          icon={Clock3}
          label="Pendentes"
          tone="amber"
          value={String(pending)}
        />
        <SummaryCard
          detail="movimentações finalizadas"
          icon={CalendarCheck}
          label="Concluidas"
          tone="green"
          value={String(completed)}
        />
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-[#0b1628]/72 p-3 lg:flex-row">
        <label className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.035] pl-11 pr-4 text-sm text-white outline-none"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar agente, motivo ou destino..."
            value={search}
          />
        </label>
        <select
          className="h-11 rounded-xl border border-white/10 bg-[#0b1628] px-4 text-sm text-slate-300"
          onChange={(event) => setStatus(event.target.value)}
          value={status}
        >
          <option value="all">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="em_andamento">Em andamento</option>
          <option value="concluida">Concluida</option>
          <option value="cancelada">Cancelada</option>
        </select>
      </section>

      <DataState
        error={data.error}
        loading={data.loading}
        noun="as movimentações"
      />

      {!data.loading && !data.error ? (
        visible.length ? (
          <section className="space-y-3">
            {visible.map((record) => {
              const recordStatus = humanText(record, "status") ?? "Em andamento";
              return (
                <article
                  className="grid gap-5 rounded-2xl border border-cyan-200/12 bg-[#0b1628]/82 p-5 lg:grid-cols-[1.3fr_1fr_1.5fr_auto]"
                  key={record._id}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-lg font-black text-cyan-200">
                        {humanText(record, "entity_name") ??
                          humanText(record, "entity_id") ??
                          "Agente"}
                      </h2>
                      <StatusPill
                        label={recordStatus}
                        tone={movementTone(recordStatus)}
                      />
                    </div>
                    <p className="mt-2 font-mono text-xs text-slate-500">
                      RA {humanText(record, "entity_id") ?? "--"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-600">
                      Movimentação
                    </p>
                    <p className="mt-2 text-sm font-bold text-white">
                      {humanText(record, "movement_type") ?? "--"}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      {humanText(record, "start_at") ?? "--"}
                      {" → "}
                      {humanText(record, "expected_end_at") ?? "sem previsão"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-600">
                      Motivo
                    </p>
                    <p className="mt-2 text-sm text-slate-300">
                      {humanText(record, "reason") ?? "--"}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      Impacto:{" "}
                      {humanText(record, "operational_impact") ?? "não informado"}
                    </p>
                  </div>
                  {canEditHuman ? (
                    <button
                      className="self-center rounded-xl border border-red-300/15 p-3 text-red-200/70"
                      onClick={() => void archive(record._id)}
                      title="Arquivar movimentação"
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </article>
              );
            })}
          </section>
        ) : (
          <div className="rounded-3xl border border-dashed border-white/10 p-12 text-center text-sm text-slate-500">
            Nenhuma movimentação registrada.
          </div>
        )
      ) : null}

      {dialog ? (
        <HumanMovementDialog
          onClose={() => setDialog(false)}
          users={users}
        />
      ) : null}
    </div>
  );
}
