"use client";

import {
  AlertTriangle,
  Ban,
  Calendar,
  CheckCircle2,
  FileCheck2,
  FileText,
  FileUp,
  History,
  ShieldAlert,
  Stethoscope,
  User,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAccessControl } from "@/features/access/providers/access-control-provider";
import {
  cancelHealthRestriction,
  endHealthRestriction,
  formatRestrictionCategory,
  formatRestrictionLevel,
  formatRestrictionStatus,
  type OperationalRestriction,
  type RestrictionLevel,
} from "@/features/health/data/health-restriction-service";
import {
  createAndUploadDischargeDocument,
  fetchEligibleDischargeDocuments,
  HEALTH_DOCUMENT_TYPE_LABELS,
  validateHealthDocumentFile,
  type CanonicalHealthDocument,
  type HealthDocumentType,
} from "@/features/health/data/health-document-service";
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
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.08] pb-3.5">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={levelTone[restriction.level]}>
                      {formatRestrictionLevel(restriction.level)}
                    </Badge>
                    <Badge tone="cyan">
                      {formatRestrictionCategory(restriction.category)}
                    </Badge>
                  </div>
                  <p className="text-sm font-semibold text-white">
                    {restriction.description}
                  </p>
                </div>
              </div>

              {/* METADATA GRID */}
              <div className="mt-3.5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs text-slate-300">
                <div className="flex items-start gap-2">
                  <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" />
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
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
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
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
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
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
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Documento Comprobatório
                    </span>
                    <span className="block truncate font-medium text-slate-200">
                      {restriction.source_document.description || "Laudo / Termo de Emissão"}
                    </span>
                    <span className="block truncate text-[10px] text-slate-500">
                      (ID: <span className="font-mono">{restriction.source_document.health_document_id}</span>)
                    </span>
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
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={item.status === "ended" ? "green" : "slate"}>
                      {formatRestrictionStatus(item.status)}
                    </Badge>
                    <Badge tone="cyan">
                      {formatRestrictionCategory(item.category)}
                    </Badge>
                    <span className="font-medium text-slate-300">— {item.description}</span>
                  </div>

                  <span className="font-mono text-[11px] text-slate-400">
                    Emitida em {dateFormatter.format(item.issued_at)}
                  </span>
                </div>

                <div className="mt-2.5 space-y-1.5 text-slate-300">
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
                          {item.end_professional.specialty
                            ? ` • ${item.end_professional.specialty}`
                            : ""}
                        </p>
                      ) : null}
                      {item.end_source_document ? (
                        <p className="text-[11px] text-slate-400">
                          Documento de liberação:{" "}
                          <span className="font-medium text-slate-200">
                            {item.end_source_document.description || "Laudo / Termo de liberação clínica"}
                          </span>{" "}
                          <span className="text-[10px] text-slate-500">
                            (ID: <span className="font-mono">{item.end_source_document.health_document_id}</span>)
                          </span>
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
  // Step 1: Detalhes da liberação clínica
  const [endReason, setEndReason] = useState("");
  const [professionalName, setProfessionalName] = useState("");
  const [registrationType, setRegistrationType] = useState("CRMV");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [clinic, setClinic] = useState("");
  const [specialty, setSpecialty] = useState("");

  // Step 2: Modo de evidência ("upload" ou "picker")
  const [evidenceMode, setEvidenceMode] = useState<"upload" | "picker">("upload");

  // Estado do Upload
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<HealthDocumentType>("report");
  const [documentTitle, setDocumentTitle] = useState(
    `Laudo de Alta Médica — ${formatRestrictionCategory(restriction.category)}`,
  );
  const [documentDescription, setDocumentDescription] = useState("");

  // Estado do Picker (documentos existentes)
  const [availableDocs, setAvailableDocs] = useState<CanonicalHealthDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  // Evidência já finalizada (sobrevive a falhas de rede/transação do END para retry)
  const [finalizedEvidence, setFinalizedEvidence] = useState<{
    description?: string | null;
    documentId: string;
    title: string;
  } | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submittingStatus, setSubmittingStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Carrega documentos do prontuário ao alternar para o picker
  useEffect(() => {
    let active = true;
    if (evidenceMode === "picker" && availableDocs.length === 0) {
      fetchEligibleDischargeDocuments(
        dogId,
        restriction.source_document.health_document_id,
      )
        .then((docs) => {
          if (active) {
            setAvailableDocs(docs);
            setLoadingDocs(false);
          }
        })
        .catch(() => {
          if (active) {
            setLoadingDocs(false);
          }
        });
    }
    return () => {
      active = false;
    };
  }, [
    evidenceMode,
    dogId,
    restriction.source_document.health_document_id,
    availableDocs.length,
  ]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) {
      setUploadFile(null);
      return;
    }
    const val = validateHealthDocumentFile(file);
    if (!val.valid) {
      setError(val.error ?? "Arquivo inválido.");
      setUploadFile(null);
      e.target.value = "";
      return;
    }
    setUploadFile(file);
    if (
      !documentTitle.trim() ||
      documentTitle.startsWith("Laudo de Alta Médica")
    ) {
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      setDocumentTitle(`Laudo de Alta — ${baseName}`);
    }
  }

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

    // Resolução da evidência documental canônica
    let resolvedDocId = finalizedEvidence?.documentId ?? null;
    let resolvedDocDesc =
      finalizedEvidence?.description ?? (documentDescription.trim() || null);

    if (!resolvedDocId) {
      if (evidenceMode === "upload") {
        if (!uploadFile) {
          setError(
            "Selecione o arquivo do laudo/termo de alta clínica para comprovação.",
          );
          return;
        }
        if (!documentTitle.trim()) {
          setError("Informe um título para o documento de alta médica.");
          return;
        }

        try {
          setSubmitting(true);
          setSubmittingStatus("Enviando documento e selando evidência clínica...");
          const uploadResult = await createAndUploadDischargeDocument(
            dogId,
            uploadFile,
            {
              description: documentDescription.trim() || undefined,
              documentType,
              issuer: professionalName.trim(),
              title: documentTitle.trim(),
            },
          );
          resolvedDocId = uploadResult.documentId;
          resolvedDocDesc =
            documentDescription.trim() || uploadResult.title;
          setFinalizedEvidence({
            description: resolvedDocDesc,
            documentId: uploadResult.documentId,
            title: uploadResult.title,
          });
        } catch (uploadErr) {
          setSubmitting(false);
          setSubmittingStatus(null);
          setError(
            uploadErr instanceof Error
              ? `Falha no upload do documento de alta: ${uploadErr.message}`
              : "Erro ao enviar e selar documento de alta clínica.",
          );
          return;
        }
      } else {
        // Modo Picker
        if (!selectedDocId) {
          setError("Selecione um documento comprobatório do prontuário.");
          return;
        }
        if (
          selectedDocId === restriction.source_document.health_document_id
        ) {
          setError(
            "O documento de abertura da restrição não pode ser reutilizado como laudo de alta.",
          );
          return;
        }
        const selectedDoc = availableDocs.find((d) => d.id === selectedDocId);
        resolvedDocId = selectedDocId;
        resolvedDocDesc =
          documentDescription.trim() || selectedDoc?.title || null;
      }
    }

    try {
      setSubmitting(true);
      setSubmittingStatus("Registrando liberação clínica no backend...");
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
          description: resolvedDocDesc,
          health_document_id: resolvedDocId,
        },
        restrictionId: restriction.id,
      });

      setSuccess("Restrição liberada clinicamente com sucesso!");
      setTimeout(() => {
        onSuccess();
      }, 1200);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao liberar restrição clínica.",
      );
    } finally {
      setSubmitting(false);
      setSubmittingStatus(null);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={submitting ? () => {} : onClose}
      title="Liberar Restrição Clinicamente"
      description="Encerramento clínico formal de restrição com emissão de alta pelo médico veterinário."
      className="max-w-3xl lg:max-w-4xl"
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-4"
        data-testid="modal-end-restriction"
      >
        <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.05] p-3.5 text-xs text-cyan-200">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-300/10 pb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">
              Restrição Selecionada
            </span>
            <div className="flex items-center gap-2">
              <Badge tone={levelTone[restriction.level]} className="text-[10px]">
                {formatRestrictionLevel(restriction.level)}
              </Badge>
              <Badge tone="cyan" className="text-[10px]">
                {formatRestrictionCategory(restriction.category)}
              </Badge>
            </div>
          </div>
          <p className="mt-2 text-sm font-semibold text-white">
            {restriction.description}
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

        <div className="space-y-3 rounded-2xl border border-white/[0.06] bg-slate-900/50 p-4">
          <h5 className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
            <User className="h-3.5 w-3.5 text-cyan-300" />
            Profissional que Concedeu a Liberação
          </h5>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
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

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1 space-y-1">
                <Label htmlFor="registrationType">Tipo de Registro</Label>
                <Input
                  id="registrationType"
                  placeholder="CRMV"
                  value={registrationType}
                  onChange={(e) => setRegistrationType(e.target.value)}
                  disabled={submitting || Boolean(success)}
                />
              </div>
              <div className="col-span-2 space-y-1">
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

        {/* COMPROVAÇÃO DOCUMENTAL (EVIDÊNCIA CANÔNICA) */}
        <div className="space-y-3 rounded-2xl border border-white/[0.06] bg-slate-900/50 p-4">
          <div className="flex items-center justify-between">
            <h5 className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
              <FileCheck2 className="h-3.5 w-3.5 text-cyan-300" />
              Comprovação Documental de Alta Clínica{" "}
              <span className="text-red-400">*</span>
            </h5>
            {finalizedEvidence ? (
              <Badge
                tone="green"
                className="text-[10px]"
              >
                Evidência Selada
              </Badge>
            ) : null}
          </div>

          {finalizedEvidence ? (
            <div
              className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-200"
              data-testid="evidence-finalized-summary"
            >
              <p className="font-semibold text-emerald-300">
                Documento Canônico Anexado:
              </p>
              <p className="font-medium text-white">{finalizedEvidence.title}</p>
              <p className="font-mono text-[10px] text-emerald-400">
                ID: {finalizedEvidence.documentId}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                A evidência foi selada no backend e será vinculada ao encerramento.
              </p>
            </div>
          ) : (
            <>
              {/* Seletor entre Upload e Picker */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEvidenceMode("upload");
                    setError(null);
                  }}
                  disabled={submitting}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border p-2.5 text-xs font-semibold transition ${
                    evidenceMode === "upload"
                      ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-200"
                      : "border-white/[0.06] bg-slate-800/40 text-slate-400 hover:text-slate-200"
                  }`}
                  data-testid="tab-upload-evidence"
                >
                  <FileUp className="h-3.5 w-3.5" />
                  Anexar Novo Laudo / Alta
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEvidenceMode("picker");
                    setError(null);
                    if (availableDocs.length === 0) {
                      setLoadingDocs(true);
                    }
                  }}
                  disabled={submitting}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border p-2.5 text-xs font-semibold transition ${
                    evidenceMode === "picker"
                      ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-200"
                      : "border-white/[0.06] bg-slate-800/40 text-slate-400 hover:text-slate-200"
                  }`}
                  data-testid="tab-select-evidence"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Selecionar do Prontuário
                </button>
              </div>

              {evidenceMode === "upload" ? (
                <div className="space-y-3 pt-1">
                  <div className="space-y-1">
                    <Label htmlFor="uploadFile">
                      Arquivo do Laudo / Termo de Alta{" "}
                      <span className="text-red-400">*</span>
                    </Label>
                    <Input
                      id="uploadFile"
                      type="file"
                      accept=".pdf,image/*,.doc,.docx"
                      onChange={handleFileChange}
                      disabled={submitting || Boolean(success)}
                      data-testid="input-upload-file"
                      className="cursor-pointer file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-cyan-500/20 file:px-2.5 file:py-1 file:font-semibold file:text-cyan-200"
                    />
                    <p className="text-[11px] text-slate-400">
                      Formatos aceitos: PDF, imagem (PNG, JPG) ou Word (DOCX).
                      Máximo: 20 MB.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="documentType">Natureza do Documento</Label>
                      <select
                        id="documentType"
                        value={documentType}
                        onChange={(e) =>
                          setDocumentType(
                            e.target.value as HealthDocumentType,
                          )
                        }
                        disabled={submitting || Boolean(success)}
                        className="w-full rounded-xl border border-white/[0.08] bg-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        data-testid="select-document-type"
                      >
                        <option value="report">Laudo Clínico / Relatório</option>
                        <option value="certificate">
                          Atestado / Certificado de Alta
                        </option>
                        <option value="surgical_report">
                          Relatório Cirúrgico
                        </option>
                        <option value="exam_pdf">Laudo de Exame (PDF)</option>
                        <option value="other">Outro Documento</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="documentTitle">
                        Título do Documento{" "}
                        <span className="text-red-400">*</span>
                      </Label>
                      <Input
                        id="documentTitle"
                        value={documentTitle}
                        onChange={(e) => setDocumentTitle(e.target.value)}
                        placeholder="Ex: Laudo de Alta Clínica e Retorno"
                        disabled={submitting || Boolean(success)}
                        data-testid="input-document-title"
                        required
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className="space-y-2 pt-1"
                  data-testid="picker-existing-documents"
                >
                  <Label>
                    Selecione um documento canônico emitido para este cão:
                  </Label>
                  {loadingDocs ? (
                    <div className="py-4 text-center text-xs text-slate-400">
                      Carregando documentos do prontuário...
                    </div>
                  ) : availableDocs.length === 0 ? (
                    <div className="rounded-xl border border-white/[0.06] bg-slate-800/40 p-4 text-center text-xs text-slate-400">
                      Nenhum outro documento canônico encontrado no prontuário.
                      Utilize a aba &quot;Anexar Novo Laudo&quot;.
                    </div>
                  ) : (
                    <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                      {availableDocs.map((doc) => {
                        const isSelected = selectedDocId === doc.id;
                        return (
                          <div
                            key={doc.id}
                            onClick={() =>
                              !submitting && setSelectedDocId(doc.id)
                            }
                            className={`flex cursor-pointer items-start justify-between rounded-xl border p-3 transition ${
                              isSelected
                                ? "border-cyan-400 bg-cyan-500/10 text-white shadow-[0_0_12px_rgba(6,182,212,0.15)]"
                                : "border-white/[0.06] bg-slate-800/40 text-slate-300 hover:border-white/[0.12] hover:bg-slate-800/60"
                            }`}
                            data-testid={`doc-option-${doc.id}`}
                          >
                            <div className="min-w-0 pr-3 space-y-1">
                              <p className="truncate text-xs font-semibold text-white">
                                {doc.title}
                              </p>
                              <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                                <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-medium text-slate-300">
                                  {HEALTH_DOCUMENT_TYPE_LABELS[
                                    doc.document_type
                                  ] ?? doc.document_type}
                                </span>
                                {doc.uploaded_at ? (
                                  <span>
                                    Emissão: {dateFormatter.format(doc.uploaded_at)}
                                  </span>
                                ) : null}
                                {doc.issuer ? <span>• {doc.issuer}</span> : null}
                              </div>
                            </div>
                            <span className="shrink-0 text-[10px] text-slate-500 font-medium">
                              (ID: <span className="font-mono text-cyan-400/80">{doc.id}</span>)
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1 pt-1">
                <Label htmlFor="documentDescription">
                  Observações do Documento de Liberação
                </Label>
                <Input
                  id="documentDescription"
                  placeholder="Ex: Alta concedida após reavaliação clínica e exame de imagem"
                  value={documentDescription}
                  onChange={(e) => setDocumentDescription(e.target.value)}
                  disabled={submitting || Boolean(success)}
                  data-testid="input-document-description"
                />
              </div>
            </>
          )}
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
            {submitting ? submittingStatus || "Processando..." : "Confirmar Liberação"}
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
      className="max-w-xl"
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-4"
        data-testid="modal-cancel-restriction"
      >
        {/* DISCLAIMER OBRIGATÓRIO */}
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div className="space-y-1">
            <p className="font-bold text-amber-300">Aviso Administrativo:</p>
            <p className="leading-relaxed">
              Esta ação invalida um registro incorreto (duplicado, cão errado ou
              erro formal). NÃO constitui alta ou liberação clínica.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-slate-900/60 p-3.5 text-xs text-slate-300">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Restrição a invalidar:
            </span>
            <div className="flex items-center gap-2">
              <Badge tone={levelTone[restriction.level]} className="text-[10px]">
                {formatRestrictionLevel(restriction.level)}
              </Badge>
              <Badge tone="slate" className="text-[10px]">
                {formatRestrictionCategory(restriction.category)}
              </Badge>
            </div>
          </div>
          <p className="mt-2 text-sm font-semibold text-white">
            {restriction.description}
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
