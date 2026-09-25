"use client";

import {
  AlertTriangle,
  Ban,
  Calendar,
  CheckCircle2,
  FileCheck2,
  FileText,
  History,
  ShieldAlert,
  Stethoscope,
  User,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAccessControl } from "@/features/access/providers/access-control-provider";
import {
  cancelHealthRestriction,
  endHealthRestriction,
  type OperationalRestriction,
  type RestrictionLevel,
} from "@/features/health/data/health-restriction-service";
import { useK9Restrictions } from "@/features/health/hooks/use-k9-restrictions";
import type { AccessAction } from "@/lib/permissions/access-control";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const levelTone: Record<RestrictionLevel, "red" | "yellow"> = {
  absolute: "red",
  attention: "yellow",
  partial: "yellow",
};

const levelLabel: Record<RestrictionLevel, string> = {
  absolute: "Restrição Absoluta",
  attention: "Atenção Operacional",
  partial: "Restrição Parcial",
};

export type K9OperationalRestrictionsProps = {
  dogId: string;
  initialRestrictions?: OperationalRestriction[];
  onCancelled?: (restrictionId: string) => void;
  onEnded?: (restrictionId: string) => void;
};

export function K9OperationalRestrictions({
  dogId,
  initialRestrictions,
  onCancelled,
  onEnded,
}: K9OperationalRestrictionsProps) {
  const { can } = useAccessControl();
  const hookResult = useK9Restrictions(initialRestrictions ? null : dogId);

  const activeRestrictions = useMemo(() => {
    if (initialRestrictions) {
      return initialRestrictions.filter((r) => r.status === "active");
    }
    return hookResult.activeRestrictions;
  }, [initialRestrictions, hookResult.activeRestrictions]);

  const historyRestrictions = useMemo(() => {
    if (initialRestrictions) {
      return initialRestrictions.filter(
        (r) => r.status === "ended" || r.status === "cancelled",
      );
    }
    return hookResult.historyRestrictions;
  }, [initialRestrictions, hookResult.historyRestrictions]);

  const loading = initialRestrictions ? false : hookResult.loading;
  const error = initialRestrictions ? null : hookResult.error;

  const canRelease = Boolean(
    can("health", "release_restriction" as AccessAction),
  );
  const canCancel = Boolean(
    can("health", "cancel_restriction" as AccessAction),
  );

  const [selectedEnd, setSelectedEnd] =
    useState<OperationalRestriction | null>(null);
  const [selectedCancel, setSelectedCancel] =
    useState<OperationalRestriction | null>(null);

  return (
    <section
      className="space-y-4 rounded-3xl border border-cyan-200/12 bg-slate-950/70 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.28)]"
      data-testid="operational-restrictions-section"
    >
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="h-5 w-5 text-amber-400" />
          <h3 className="text-base font-black text-white">
            Restrições Operacionais
          </h3>
        </div>
        {activeRestrictions.length > 0 ? (
          <Badge tone="red">
            {activeRestrictions.length}{" "}
            {activeRestrictions.length === 1 ? "restrição ativa" : "restrições ativas"}
          </Badge>
        ) : (
          <Badge tone="green">Nenhuma restrição ativa</Badge>
        )}
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-300">
          Falha ao carregar restrições operacionais: {error}
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-3">
          <div className="h-24 animate-pulse rounded-2xl bg-white/[0.04]" />
        </div>
      ) : null}

      {/* ACTIVE RESTRICTIONS LIST */}
      {!loading && activeRestrictions.length > 0 ? (
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Restrições Ativas
          </h4>
          {activeRestrictions.map((restriction) => (
            <article
              key={restriction.id}
              className={`rounded-2xl border p-4 transition-all ${
                restriction.level === "absolute"
                  ? "border-red-500/35 bg-gradient-to-br from-red-500/10 to-slate-950/80 shadow-[0_0_24px_rgba(239,68,68,0.12)]"
                  : "border-amber-400/30 bg-gradient-to-br from-amber-400/10 to-slate-950/80 shadow-[0_0_24px_rgba(245,158,11,0.08)]"
              }`}
              data-testid="active-restriction-card"
            >
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-white/[0.08] pb-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge tone={levelTone[restriction.level]}>
                      {levelLabel[restriction.level]}
                    </Badge>
                    <span className="text-xs font-semibold text-slate-300">
                      Categoria: {restriction.category}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-white">
                    {restriction.description}
                  </p>
                </div>
              </div>

              {/* METADATA GRID */}
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs text-slate-300">
                <div className="flex items-start gap-2">
                  <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" />
                  <div>
                    <span className="block text-[10px] uppercase text-slate-500">
                      Emissão
                    </span>
                    <span className="font-medium text-slate-200">
                      {dateFormatter.format(restriction.issued_at)}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
                  <div>
                    <span className="block text-[10px] uppercase text-slate-500">
                      Previsão de Término
                    </span>
                    <span className="font-medium text-slate-200">
                      {restriction.expected_end
                        ? dateFormatter.format(restriction.expected_end)
                        : "Indeterminada"}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Stethoscope className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" />
                  <div className="min-w-0">
                    <span className="block text-[10px] uppercase text-slate-500">
                      Profissional
                    </span>
                    <span className="block truncate font-medium text-slate-200">
                      {restriction.professional.name || "Não informado"}
                    </span>
                    <span className="block truncate text-[11px] text-slate-400">
                      {restriction.professional.registration_type}{" "}
                      {restriction.professional.registration_number}
                      {restriction.professional.clinic
                        ? ` • ${restriction.professional.clinic}`
                        : ""}
                      {restriction.professional.specialty
                        ? ` • ${restriction.professional.specialty}`
                        : ""}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" />
                  <div className="min-w-0">
                    <span className="block text-[10px] uppercase text-slate-500">
                      Documento Comprobatório
                    </span>
                    <span className="block truncate font-mono text-[11px] font-medium text-cyan-200">
                      {restriction.source_document.health_document_id}
                    </span>
                    {restriction.source_document.description ? (
                      <span className="block truncate text-[11px] text-slate-400">
                        {restriction.source_document.description}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* ACTION BUTTONS (GATED STRICTLY BY CAPABILITY) */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-3">
                <span className="text-[11px] text-slate-400">
                  Registrado por: {restriction.recorded_by.name || "Sistema"}
                  {restriction.recorded_by.internal_role
                    ? ` (${restriction.recorded_by.internal_role})`
                    : ""}
                </span>

                <div className="flex flex-wrap items-center gap-2">
                  {canRelease ? (
                    <Button
                      data-testid="btn-end-restriction"
                      variant="primary"
                      onClick={() => setSelectedEnd(restriction)}
                      className="h-8 gap-1.5 px-3 text-xs"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Liberar / Encerrar Clinicamente
                    </Button>
                  ) : null}

                  {canCancel ? (
                    <Button
                      data-testid="btn-cancel-restriction"
                      variant="danger"
                      onClick={() => setSelectedCancel(restriction)}
                      className="h-8 gap-1.5 px-3 text-xs"
                    >
                      <Ban className="h-3.5 w-3.5" />
                      Invalidar Registro
                    </Button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {!loading && activeRestrictions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-cyan-200/15 bg-black/20 p-4 text-center text-xs text-slate-400">
          Nenhuma restrição operacional ativa para este K9.
        </div>
      ) : null}

      {/* HISTORY SECTION */}
      {historyRestrictions.length > 0 ? (
        <div className="mt-6 space-y-3 border-t border-white/[0.08] pt-4">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-slate-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Histórico de Restrições Encerradas / Invalidadas
            </h4>
          </div>

          <div className="space-y-2.5">
            {historyRestrictions.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-white/[0.06] bg-slate-900/60 p-3.5 text-xs"
                data-testid="history-restriction-card"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.05] pb-2">
                  <div className="flex items-center gap-2">
                    <Badge tone={item.status === "ended" ? "green" : "slate"}>
                      {item.status === "ended"
                        ? "Liberada Clinicamente"
                        : "Registro Invalidado"}
                    </Badge>
                    <span className="font-bold text-slate-200">
                      {item.category}
                    </span>
                    <span className="text-slate-400">— {item.description}</span>
                  </div>

                  <span className="font-mono text-[11px] text-slate-400">
                    Emitida em {dateFormatter.format(item.issued_at)}
                  </span>
                </div>

                <div className="mt-2.5 space-y-1 text-slate-300">
                  {item.status === "ended" ? (
                    <>
                      <p>
                        <strong className="text-emerald-300">
                          Motivo da liberação clínica:
                        </strong>{" "}
                        {item.end_reason || "Não informado"}
                      </p>
                      {item.end_professional ? (
                        <p className="text-[11px] text-slate-400">
                          Profissional responsável: {item.end_professional.name} (
                          {item.end_professional.registration_type}{" "}
                          {item.end_professional.registration_number})
                          {item.end_professional.clinic
                            ? ` • ${item.end_professional.clinic}`
                            : ""}
                        </p>
                      ) : null}
                      {item.end_source_document ? (
                        <p className="text-[11px] text-slate-400">
                          Documento de liberação:{" "}
                          <span className="font-mono text-cyan-300">
                            {item.end_source_document.health_document_id}
                          </span>
                          {item.end_source_document.description
                            ? ` (${item.end_source_document.description})`
                            : ""}
                        </p>
                      ) : null}
                      {item.actual_end ? (
                        <p className="text-[10px] text-slate-500">
                          Encerrado em {dateFormatter.format(item.actual_end)}
                          {item.ended_by ? ` por ${item.ended_by.name}` : ""}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <p>
                        <strong className="text-red-300">
                          Justificativa da invalidação:
                        </strong>{" "}
                        {item.cancel_reason || "Não informada"}
                      </p>
                      {item.cancelled_at ? (
                        <p className="text-[10px] text-slate-500">
                          Invalidado em {dateFormatter.format(item.cancelled_at)}
                          {item.cancelled_by
                            ? ` por ${item.cancelled_by.name}`
                            : ""}
                        </p>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* MODAL: END RESTRICTION */}
      {selectedEnd ? (
        <EndRestrictionDialog
          dogId={dogId}
          open={Boolean(selectedEnd)}
          restriction={selectedEnd}
          onClose={() => setSelectedEnd(null)}
          onSuccess={() => {
            if (onEnded) onEnded(selectedEnd.id);
            setSelectedEnd(null);
          }}
        />
      ) : null}

      {/* MODAL: CANCEL RESTRICTION */}
      {selectedCancel ? (
        <CancelRestrictionDialog
          dogId={dogId}
          open={Boolean(selectedCancel)}
          restriction={selectedCancel}
          onClose={() => setSelectedCancel(null)}
          onSuccess={() => {
            if (onCancelled) onCancelled(selectedCancel.id);
            setSelectedCancel(null);
          }}
        />
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// MODAL: LIBERAR / ENCERRAR CLINICAMENTE (END)
// ---------------------------------------------------------------------------

type EndRestrictionDialogProps = {
  dogId: string;
  onClose: () => void;
  onSuccess: () => void;
  open: boolean;
  restriction: OperationalRestriction;
};

function EndRestrictionDialog({
  dogId,
  onClose,
  onSuccess,
  open,
  restriction,
}: EndRestrictionDialogProps) {
  const [endReason, setEndReason] = useState("");
  const [professionalName, setProfessionalName] = useState("");
  const [registrationType, setRegistrationType] = useState("CRMV");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [clinic, setClinic] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [healthDocumentId, setHealthDocumentId] = useState("");
  const [documentDescription, setDocumentDescription] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!endReason.trim()) {
      setError("Informe o motivo da liberação clínica.");
      return;
    }
    if (!professionalName.trim()) {
      setError("Informe o nome do profissional veterinário responsável.");
      return;
    }
    if (!registrationNumber.trim()) {
      setError("Informe o número de registro do CRMV.");
      return;
    }
    if (!healthDocumentId.trim()) {
      setError("Informe o ID do documento canônico comprobatório.");
      return;
    }

    try {
      setSubmitting(true);
      await endHealthRestriction({
        dogId,
        endProfessional: {
          clinic: clinic.trim() || null,
          name: professionalName.trim(),
          registration_number: registrationNumber.trim(),
          registration_type: registrationType.trim() || "CRMV",
          specialty: specialty.trim() || null,
        },
        endReason: endReason.trim(),
        endSourceDocument: {
          description: documentDescription.trim() || null,
          health_document_id: healthDocumentId.trim(),
        },
        restrictionId: restriction.id,
      });

      setSuccess("Restrição liberada clinicamente com sucesso!");
      setTimeout(() => {
        onSuccess();
      }, 1200);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao liberar restrição clínica.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={submitting ? () => {} : onClose}
      title="Liberar Restrição Clinicamente"
      description="Encerramento clínico formal de restrição com emissão de alta pelo médico veterinário."
      className="max-w-lg"
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-4"
        data-testid="modal-end-restriction"
      >
        <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.06] p-3 text-xs text-cyan-200">
          <p className="font-bold">Restrição selecionada:</p>
          <p className="text-white">
            {restriction.category} — {restriction.description}
          </p>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
            {success}
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="endReason">
            Motivo da Liberação Clínica <span className="text-red-400">*</span>
          </Label>
          <Input
            id="endReason"
            placeholder="Ex: Cão plenamente recuperado da lesão articular; apto a retorno."
            value={endReason}
            onChange={(e) => setEndReason(e.target.value)}
            disabled={submitting || Boolean(success)}
            required
          />
        </div>

        <div className="space-y-3 rounded-2xl border border-white/[0.06] bg-slate-900/50 p-3.5">
          <h5 className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
            <User className="h-3.5 w-3.5 text-cyan-300" />
            Profissional que Concedeu a Liberação
          </h5>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="professionalName">
                Nome do Profissional <span className="text-red-400">*</span>
              </Label>
              <Input
                id="professionalName"
                placeholder="Ex: Dra. Ana Paula Silveira"
                value={professionalName}
                onChange={(e) => setProfessionalName(e.target.value)}
                disabled={submitting || Boolean(success)}
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="registrationType">Tipo de Registro</Label>
              <Input
                id="registrationType"
                placeholder="CRMV"
                value={registrationType}
                onChange={(e) => setRegistrationType(e.target.value)}
                disabled={submitting || Boolean(success)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="registrationNumber">
                Número do Registro <span className="text-red-400">*</span>
              </Label>
              <Input
                id="registrationNumber"
                placeholder="Ex: 12345/SP"
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
                disabled={submitting || Boolean(success)}
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="clinic">Clínica / Hospital</Label>
              <Input
                id="clinic"
                placeholder="Ex: Hospital Vet Canil Central"
                value={clinic}
                onChange={(e) => setClinic(e.target.value)}
                disabled={submitting || Boolean(success)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="specialty">Especialidade</Label>
              <Input
                id="specialty"
                placeholder="Ex: Ortopedia"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                disabled={submitting || Boolean(success)}
              />
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-white/[0.06] bg-slate-900/50 p-3.5">
          <h5 className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
            <FileCheck2 className="h-3.5 w-3.5 text-cyan-300" />
            Documento Canônico Comprobatório
          </h5>

          <div className="space-y-1">
            <Label htmlFor="healthDocumentId">
              ID do Documento de Saúde <span className="text-red-400">*</span>
            </Label>
            <Input
              id="healthDocumentId"
              placeholder="Ex: doc_laudo_alta_2026_09"
              value={healthDocumentId}
              onChange={(e) => setHealthDocumentId(e.target.value)}
              disabled={submitting || Boolean(success)}
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="documentDescription">Descrição do Documento</Label>
            <Input
              id="documentDescription"
              placeholder="Ex: Laudo pericial e termo de alta clínica emitido"
              value={documentDescription}
              onChange={(e) => setDocumentDescription(e.target.value)}
              disabled={submitting || Boolean(success)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-white/[0.06] pt-3">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={submitting || Boolean(success)}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={submitting || Boolean(success)}
          >
            {submitting ? "Processando Liberação..." : "Confirmar Liberação"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// MODAL: INVALIDAR REGISTRO (CANCEL)
// ---------------------------------------------------------------------------

type CancelRestrictionDialogProps = {
  dogId: string;
  onClose: () => void;
  onSuccess: () => void;
  open: boolean;
  restriction: OperationalRestriction;
};

function CancelRestrictionDialog({
  dogId,
  onClose,
  onSuccess,
  open,
  restriction,
}: CancelRestrictionDialogProps) {
  const [cancelReason, setCancelReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!cancelReason.trim()) {
      setError("Informe a justificativa administrativa para o cancelamento.");
      return;
    }

    try {
      setSubmitting(true);
      await cancelHealthRestriction({
        cancelReason: cancelReason.trim(),
        dogId,
        restrictionId: restriction.id,
      });

      setSuccess("Registro de restrição invalidado com sucesso.");
      setTimeout(() => {
        onSuccess();
      }, 1200);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao invalidar registro de restrição.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={submitting ? () => {} : onClose}
      title="Invalidar Registro de Restrição"
      description="Invalidação puramente administrativa por duplicidade, cão incorreto ou erro formal."
      className="max-w-lg"
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-4"
        data-testid="modal-cancel-restriction"
      >
        {/* DISCLAIMER OBRIGATÓRIO */}
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div>
            <p className="font-bold">Aviso Administrativo:</p>
            <p className="mt-0.5">
              Esta ação invalida um registro incorreto (duplicado, cão errado ou
              erro formal). NÃO constitui alta ou liberação clínica.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-slate-900/60 p-3 text-xs text-slate-300">
          <p className="font-bold text-slate-400">Restrição a invalidar:</p>
          <p className="text-white">
            {restriction.category} — {restriction.description}
          </p>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
            {success}
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="cancelReason">
            Justificativa Administrativa do Cancelamento{" "}
            <span className="text-red-400">*</span>
          </Label>
          <Input
            id="cancelReason"
            placeholder="Ex: Registro duplicado lançado por equívoco no cão incorreto."
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            disabled={submitting || Boolean(success)}
            required
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-white/[0.06] pt-3">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={submitting || Boolean(success)}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="danger"
            disabled={submitting || Boolean(success)}
          >
            {submitting ? "Invalidando..." : "Confirmar Invalidação"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
