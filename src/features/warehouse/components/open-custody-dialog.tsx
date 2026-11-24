"use client";

import React, { useState } from "react";
import { CustodyPurpose, Equipment } from "../domain/contracts";
import { generateWarehouseIdempotencyKey, WarehouseService } from "../data/warehouse-service";
import { validateOpenCustodyPayload } from "../domain/validation";

interface OpenCustodyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  equipment: Equipment;
}

const PURPOSES: Array<{ value: CustodyPurpose; label: string }> = [
  { value: "daily_duty", label: "Serviço Operacional / Plantão" },
  { value: "operation", label: "Operação Policial Especial" },
  { value: "training", label: "Instrução / Treinamento K9" },
  { value: "permanent_assignment", label: "Cautela Permanente / Longo Prazo" },
];

export function OpenCustodyDialog({
  isOpen,
  onClose,
  onSuccess,
  equipment,
}: OpenCustodyDialogProps) {
  const [borrowerRa, setBorrowerRa] = useState("");
  const [borrowerName, setBorrowerName] = useState("");
  const [purpose, setPurpose] = useState<CustodyPurpose>("daily_duty");
  const [expectedReturnDate, setExpectedReturnDate] = useState("");
  const [linkedDogName, setLinkedDogName] = useState(equipment.assigned_dog_name || "");
  const [linkedVehiclePrefix, setLinkedVehiclePrefix] = useState(
    equipment.assigned_vehicle_prefix || "",
  );
  const [dispatchNotes, setDispatchNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const validationErrors = validateOpenCustodyPayload({
      equipment_id: equipment.id,
      borrower_ra: borrowerRa,
      borrower_name: borrowerName,
      purpose,
      condition_at_dispatch: equipment.condition,
      expected_return_at: expectedReturnDate || undefined,
    });

    if (Object.keys(validationErrors).length > 0) {
      setErrorMessage(Object.values(validationErrors)[0]);
      return;
    }

    setIsSubmitting(true);
    try {
      const idempotencyKey = generateWarehouseIdempotencyKey("open-custody", equipment.id);
      await WarehouseService.openCustody({
        equipment_id: equipment.id,
        borrower_ra: borrowerRa.trim(),
        borrower_name: borrowerName.trim(),
        purpose,
        condition_at_dispatch: equipment.condition,
        expected_return_at: expectedReturnDate ? new Date(expectedReturnDate).toISOString() : null,
        linked_dog_name: linkedDogName.trim() || null,
        linked_vehicle_prefix: linkedVehiclePrefix.trim() || null,
        dispatch_notes: dispatchNotes.trim() || null,
        idempotency_key: idempotencyKey,
      });

      onClose();
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Erro ao abrir cautela.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="open-custody-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto"
    >
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl text-white my-8">
        <header className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">Despacho de Material</p>
          <h2 id="open-custody-title" className="text-xl font-bold">
            Abrir Cautela Operacional
          </h2>
          <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
            <span className="font-semibold text-white">{equipment.name}</span>
            <span className="text-slate-400 ml-2">({equipment.identifier_code})</span>
            <div className="mt-1 flex gap-2 text-xs text-slate-300">
              <span>Condição: <strong className="text-cyan-300">{equipment.condition}</strong></span>
              <span>· Local: <strong className="text-slate-200">{equipment.current_location_name}</strong></span>
            </div>
          </div>
        </header>

        {errorMessage && (
          <div role="alert" className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="custody-borrower-ra" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                RA do Policial / Condutor *
              </label>
              <input
                id="custody-borrower-ra"
                type="text"
                value={borrowerRa}
                onChange={(e) => setBorrowerRa(e.target.value)}
                placeholder="Ex: 12345"
                required
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="custody-borrower-name" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Nome do Policial *
              </label>
              <input
                id="custody-borrower-name"
                type="text"
                value={borrowerName}
                onChange={(e) => setBorrowerName(e.target.value)}
                placeholder="Ex: Sd PM Silva"
                required
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="custody-purpose" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Finalidade da Cautela *
            </label>
            <select
              id="custody-purpose"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value as CustodyPurpose)}
              required
              className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
            >
              {PURPOSES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="custody-return-date" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Previsão de Devolução (Opcional)
            </label>
            <input
              id="custody-return-date"
              type="datetime-local"
              value={expectedReturnDate}
              onChange={(e) => setExpectedReturnDate(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
            />
            <p className="mt-1 text-xs text-slate-400">
              Permite alertar quando a cautela estiver atrasada no final do turno ou serviço.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="custody-dog" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Cão Vinculado (Opcional)
              </label>
              <input
                id="custody-dog"
                type="text"
                value={linkedDogName}
                onChange={(e) => setLinkedDogName(e.target.value)}
                placeholder="Ex: Thor"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="custody-vtr" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Viatura Vinculada (Opcional)
              </label>
              <input
                id="custody-vtr"
                type="text"
                value={linkedVehiclePrefix}
                onChange={(e) => setLinkedVehiclePrefix(e.target.value)}
                placeholder="Ex: VTR-09"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="custody-notes" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Observações do Despacho
            </label>
            <textarea
              id="custody-notes"
              rows={2}
              value={dispatchNotes}
              onChange={(e) => setDispatchNotes(e.target.value)}
              placeholder="Instruções adicionais, equipe ou turno..."
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/10 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-cyan-500 px-5 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-400 transition disabled:opacity-50"
            >
              {isSubmitting ? "Expedindo..." : "Confirmar Cautela"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
