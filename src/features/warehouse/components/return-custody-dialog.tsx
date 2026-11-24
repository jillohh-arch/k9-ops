"use client";

import React, { useState } from "react";
import { Equipment, EquipmentCondition, EquipmentCustody, WarehouseLocation } from "../domain/contracts";
import { generateWarehouseIdempotencyKey, ReturnEquipmentStatus, WarehouseService } from "../data/warehouse-service";
import { validateReturnCustodyPayload } from "../domain/validation";

interface ReturnCustodyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  custody: EquipmentCustody;
  equipment?: Equipment;
  locations?: WarehouseLocation[];
}

const CONDITIONS: Array<{ value: EquipmentCondition; label: string }> = [
  { value: "new", label: "Novo (sem alterações)" },
  { value: "good", label: "Bom (íntegro / pronto para reuso)" },
  { value: "fair", label: "Regular (desgaste natural de uso)" },
  { value: "damaged", label: "Danificado / Avariado (requer manutenção)" },
];

export function ReturnCustodyDialog({
  isOpen,
  onClose,
  onSuccess,
  custody,
  equipment,
  locations = [],
}: ReturnCustodyDialogProps) {
  const [conditionAtReturn, setConditionAtReturn] = useState<EquipmentCondition>(
    custody.condition_at_dispatch || "good",
  );
  const [targetEquipmentStatus, setTargetEquipmentStatus] = useState<ReturnEquipmentStatus>("available");
  const [returnLocationId, setReturnLocationId] = useState<string>(
    equipment?.current_location_id || locations[0]?.id || "",
  );
  const [returnNotes, setReturnNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConditionChange = (cond: EquipmentCondition) => {
    setConditionAtReturn(cond);
    if (cond === "damaged" && targetEquipmentStatus === "available") {
      setTargetEquipmentStatus("maintenance");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const validationErrors = validateReturnCustodyPayload({
      custody_id: custody.id,
      condition_at_return: conditionAtReturn,
      target_equipment_status: targetEquipmentStatus,
      return_notes: returnNotes,
    });

    if (Object.keys(validationErrors).length > 0) {
      setErrorMessage(Object.values(validationErrors)[0]);
      return;
    }

    const selectedLocation = locations.find((loc) => loc.id === returnLocationId);
    const resolvedLocationName =
      selectedLocation?.name ||
      (returnLocationId && equipment?.current_location_id === returnLocationId
        ? equipment.current_location_name
        : undefined);

    setIsSubmitting(true);
    try {
      const idempotencyKey = generateWarehouseIdempotencyKey("return-custody", custody.id);
      await WarehouseService.returnCustody({
        custody_id: custody.id,
        condition_at_return: conditionAtReturn,
        return_location_id: returnLocationId || undefined,
        return_location_name: resolvedLocationName || undefined,
        target_equipment_status: targetEquipmentStatus,
        return_notes: returnNotes.trim() || null,
        idempotency_key: idempotencyKey,
      });

      onClose();
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Erro ao receber devolução da cautela.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="return-custody-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto"
    >
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl text-white my-8">
        <header className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">Vistoria e Recebimento</p>
          <h2 id="return-custody-title" className="text-xl font-bold">
            Devolução de Cautela
          </h2>
          <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
            <div className="font-semibold text-white">
              {custody.equipment_name}{" "}
              <span className="text-slate-400 text-xs">({custody.equipment_code})</span>
            </div>
            <div className="mt-1 text-xs text-slate-300">
              Responsável: <strong className="text-slate-100">{custody.borrower_name}</strong> (RA {custody.borrower_ra})
            </div>
          </div>
        </header>

        {errorMessage && (
          <div role="alert" className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="return-condition" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Condição Física na Devolução *
            </label>
            <select
              id="return-condition"
              value={conditionAtReturn}
              onChange={(e) => handleConditionChange(e.target.value as EquipmentCondition)}
              required
              className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
            >
              {CONDITIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="return-status" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Status Resultante *
              </label>
              <select
                id="return-status"
                value={targetEquipmentStatus}
                onChange={(e) => {
                  const nextStatus = e.target.value as ReturnEquipmentStatus;
                  setTargetEquipmentStatus(nextStatus);
                  // Coerência status x condição (backend fail-closed): danificado => condição "damaged".
                  if (nextStatus === "damaged") setConditionAtReturn("damaged");
                }}
                required
                className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
              >
                {conditionAtReturn !== "damaged" && (
                  <option value="available">Disponível (Pronto para reuso)</option>
                )}
                <option value="maintenance">Manutenção (Requer reparo)</option>
                <option value="damaged">Danificado (Aguardando vistoria)</option>
              </select>
            </div>

            {locations.length > 0 && (
              <div>
                <label htmlFor="return-location" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Local de Armazenamento
                </label>
                <select
                  id="return-location"
                  value={returnLocationId}
                  onChange={(e) => setReturnLocationId(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="return-notes" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Notas da Vistoria {conditionAtReturn === "damaged" && <span className="text-rose-400">* (Obrigatório por avaria)</span>}
            </label>
            <textarea
              id="return-notes"
              rows={3}
              value={returnNotes}
              onChange={(e) => setReturnNotes(e.target.value)}
              placeholder={conditionAtReturn === "damaged" ? "Descreva detalhadamente o dano observado..." : "Observações sobre o estado do item..."}
              required={conditionAtReturn === "damaged"}
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
              {isSubmitting ? "Recebendo..." : "Confirmar Devolução"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
