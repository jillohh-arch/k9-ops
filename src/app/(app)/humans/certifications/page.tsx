"use client";

import {
  CalendarClock,
  CheckCircle2,
  FileText,
  Filter,
  GraduationCap,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

import { useAccessControl } from "@/features/access/providers/access-control-provider";
import { HumanRecordDialog } from "@/features/effective/components/human-record-dialogs";
import {
  DataState,
  EffectiveHeader,
  StatusPill,
  SummaryCard,
} from "@/features/effective/components/effective-ui";
import {
  archiveHumanCertification,
  archiveHumanDocument,
} from "@/features/effective/data/human-admin-service";
import {
  humanDate,
  humanText,
  useHumanAdministrativeRecords,
} from "@/features/effective/hooks/use-human-profile-data";

function normalize(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function validity(expiresAt: string | null) {
  if (!expiresAt) return { label: "Sem validade", tone: "slate" as const };
  const date = humanDate(expiresAt);
  if (!date) return { label: "Data inválida", tone: "violet" as const };
  const days = Math.ceil((date.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { label: "Vencido", tone: "violet" as const };
  if (days <= 30) {
    return { label: `Vence em ${days} dias`, tone: "amber" as const };
  }
  return { label: "Válido", tone: "green" as const };
}

export default function HumanCertificationsPage() {
  const { can } = useAccessControl();
  const data = useHumanAdministrativeRecords();
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("all");
  const [ownerRa, setOwnerRa] = useState("");
  const [dialog, setDialog] = useState<"certification" | "document" | null>(
    null,
  );
  const users = useMemo(
    () =>
      data.users.map((user) => ({
        label: `${humanText(user, "callsign", "nomeCompleto", "name") ?? user._id} - RA ${user._id}`,
        value: user._id,
      })),
    [data.users],
  );
  const usersByRa = useMemo(
    () => new Map(data.users.map((user) => [user._id, user])),
    [data.users],
  );
  const visible = useMemo(() => {
    const needle = normalize(search);
    return data.records.filter((record) => {
      const owner = humanText(record, "_ownerRa") ?? "";
      const ownerName = humanText(
        usersByRa.get(owner) ?? null,
        "callsign",
        "nomeCompleto",
        "name",
      );
      return (
        (kind === "all" || record._source === kind) &&
        (!needle ||
          [
            humanText(record, "name", "type", "issuer", "category"),
            owner,
            ownerName,
          ].some((value) => normalize(value).includes(needle)))
      );
    });
  }, [data.records, kind, search, usersByRa]);
  const valid = data.records.filter(
    (record) => validity(humanText(record, "expires_at")).label === "Válido",
  ).length;
  const expiring = data.records.filter((record) =>
    validity(humanText(record, "expires_at")).label.startsWith("Vence em"),
  ).length;
  const expired = data.records.filter(
    (record) => validity(humanText(record, "expires_at")).label === "Vencido",
  ).length;
  const canEditHuman = can("humans", "edit");

  async function archiveRecord(
    source: string,
    ra: string,
    id: string,
  ) {
    if (!canEditHuman) return;
    const reason = window.prompt("Motivo do arquivamento:");
    if (!reason || reason.trim().length < 5) return;
    if (source === "certifications") {
      await archiveHumanCertification(ra, id, reason.trim());
    } else {
      await archiveHumanDocument(ra, id, reason.trim());
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <EffectiveHeader
          description="Validade, anexos e rastreabilidade documental do efetivo humano."
          title="Certificações e documentos"
        />
        {canEditHuman ? (
          <div className="flex flex-wrap gap-3">
            <select
              className="h-11 rounded-xl border border-white/10 bg-[#0b1628] px-4 text-sm text-slate-300"
              onChange={(event) => setOwnerRa(event.target.value)}
              value={ownerRa}
            >
              <option value="">Selecione o agente</option>
              {users.map((user) => (
                <option key={user.value} value={user.value}>
                  {user.label}
                </option>
              ))}
            </select>
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-[0_0_24px_rgba(77,208,225,0.24)] hover:bg-cyan-200 disabled:opacity-40"
              disabled={!ownerRa}
              onClick={() => setDialog("certification")}
              type="button"
            >
              <Plus className="h-4 w-4" /> Certificação
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/25 px-4 py-2.5 text-sm font-bold text-cyan-200 disabled:opacity-40"
              disabled={!ownerRa}
              onClick={() => setDialog("document")}
              type="button"
            >
              <Plus className="h-4 w-4" /> Documento
            </button>
          </div>
        ) : null}
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          detail="registros ativos"
          icon={FileText}
          label="Total documental"
          tone="cyan"
          value={String(data.records.length)}
        />
        <SummaryCard
          detail="validade superior a 30 dias"
          icon={CheckCircle2}
          label="Válidos"
          tone="green"
          value={String(valid)}
        />
        <SummaryCard
          detail="nos próximos 30 dias"
          icon={CalendarClock}
          label="A vencer"
          tone="amber"
          value={String(expiring)}
        />
        <SummaryCard
          detail="requerem regularização"
          icon={GraduationCap}
          label="Vencidos"
          tone="violet"
          value={String(expired)}
        />
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-[#0b1628]/72 p-3 lg:flex-row">
        <label className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.035] pl-11 pr-4 text-sm text-white outline-none"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar agente, certificado ou emissor..."
            value={search}
          />
        </label>
        <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-4">
          <Filter className="h-4 w-4 text-slate-500" />
          <select
            className="h-11 bg-transparent text-sm text-slate-300 outline-none"
            onChange={(event) => setKind(event.target.value)}
            value={kind}
          >
            <option className="bg-[#0b1628]" value="all">
              Todos
            </option>
            <option className="bg-[#0b1628]" value="certifications">
              Certificações
            </option>
            <option className="bg-[#0b1628]" value="documents">
              Documentos
            </option>
          </select>
        </label>
      </section>

      <DataState
        error={data.error}
        loading={data.loading}
        noun="as certificações"
      />

      {!data.loading && !data.error ? (
        visible.length ? (
          <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {visible.map((record) => {
              const ra = humanText(record, "_ownerRa") ?? "";
              const owner = usersByRa.get(ra);
              const state = validity(humanText(record, "expires_at"));
              return (
                <article
                  className="rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-5"
                  key={`${record._source}-${ra}-${record._id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.15em] text-cyan-300">
                        {record._source === "documents"
                          ? "Documento"
                          : "Certificação"}
                      </p>
                      <h2 className="mt-2 text-lg font-black text-white">
                        {humanText(record, "name") ?? "Sem nome"}
                      </h2>
                    </div>
                    <StatusPill label={state.label} tone={state.tone} />
                  </div>
                  <p className="mt-4 text-sm font-semibold text-slate-300">
                    {humanText(owner ?? null, "callsign", "nomeCompleto") ?? ra}
                  </p>
                  <p className="mt-1 font-mono text-xs text-slate-500">
                    RA {ra}
                  </p>
                  <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/8 pt-4 text-xs">
                    <div>
                      <p className="text-slate-600">Emissao</p>
                      <p className="mt-1 text-slate-300">
                        {humanText(record, "issued_at") ?? "--"}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-600">Validade</p>
                      <p className="mt-1 text-slate-300">
                        {humanText(record, "expires_at") ?? "--"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    {humanText(record, "document_url") ? (
                      <a
                        className="flex-1 rounded-xl border border-cyan-300/20 px-3 py-2 text-center text-xs font-bold text-cyan-200"
                        href={humanText(record, "document_url")!}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Abrir anexo
                      </a>
                    ) : null}
                    {canEditHuman ? (
                      <button
                        className="rounded-xl border border-red-300/15 p-2 text-red-200/70"
                        onClick={() =>
                          void archiveRecord(record._source, ra, record._id)
                        }
                        title="Arquivar"
                        type="button"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </section>
        ) : (
          <div className="rounded-3xl border border-dashed border-white/10 p-12 text-center text-sm text-slate-500">
            Nenhum registro documental encontrado.
          </div>
        )
      ) : null}

      {dialog && ownerRa ? (
        <HumanRecordDialog
          kind={dialog}
          onClose={() => setDialog(null)}
          ra={ownerRa}
        />
      ) : null}
    </div>
  );
}
