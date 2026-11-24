"use client";

import React, { useState } from "react";
import { Equipment, EquipmentCondition, EquipmentStatus } from "../domain/contracts";
import { WarehouseService } from "../data/warehouse-service";
import { validateConditionStatusConsistency } from "../domain/custody";

interface EquipmentStatusDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  equipment: Equipment;
}

const STATUS_OPTIONS: Array<{ value: EquipmentStatus; label: string }> = [
  { value: "available", label: "Disponível (Pronto para emprego)" },
  { value: "maintenance", label: "Em Manutenção (Oficina / Reparo)" },
  { value: "damaged", label: "Danificado (Aguardando destinação)" },
];

const CONDITION_OPTIONS: Array<{ value: EquipmentCondition; label: string }> = [
  { value: "new", label: "Novo" },
  { value: "good", label: "Bom" },
  { value: "fair", label: "Regular" },
  { value: "damaged", label: "Danificado" },
];

export function EquipmentStatusDialog({
  isOpen,
  onClose,
  onSuccess,
  equipment,
}: EquipmentStatusDialogProps) {
  const [targetStatus, setTargetStatus] = useState<EquipmentStatus>(
    equipment.status === "maintenance" ? "available" : "maintenance",
  );
  const [condition, setCondition] = useState<EquipmentCondition>(
    equipment.condition,
  );
  const [notes, setNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConditionChange = (newCond: EquipmentCondition) => {
    setCondition(newCond);
    if (newCond === "damaged" && targetStatus === "available") {
      setTargetStatus("maintenance");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const consistency = validateConditionStatusConsistency(condition, targetStatus);
    if (!consistency.valid) {
      setErrorMessage(consistency.error || "Combinação inválida de condição e status.");
      return;
    }

    setIsSubmitting(true);
    try {
      await WarehouseService.updateEquipmentStatus({
        equipment_id: equipment.id,
        target_status: targetStatus,
        condition,
        notes: notes.trim() || null,
      });

      onClose();
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Erro ao alterar status do equipamento.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="status-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto"
    >
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl text-white my-8">
        <header className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">Transição Operacional</p>
          <h2 id="status-dialog-title" className="text-xl font-bold">
            Manutenção / Alterar Situação
          </h2>
          <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
            <span className="font-semibold text-white">{equipment.name}</span>
            <span className="text-slate-400 ml-2">({equipment.identifier_code})</span>
            <div className="mt-1 flex gap-2 text-xs text-slate-300">
              <span>Situação atual: <strong className="text-cyan-300">{equipment.status}</strong></span>
              <span>· Condição: <strong className="text-slate-100">{equipment.condition}</strong></span>
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
            <label htmlFor="new-status" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Nova Situação *
            </label>
            <select
              id="new-status"
              value={targetStatus}
              onChange={(e) => setTargetStatus(e.target.value as EquipmentStatus)}
              required
              className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="new-condition" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Condição Física Atualizada *
            </label>
            <select
              id="new-condition"
              value={condition}
              onChange={(e) => handleConditionChange(e.target.value as EquipmentCondition)}
              required
              className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
            >
              {CONDITION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="status-notes" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Notas do Reparo / Justificativa
            </label>
            <textarea
              id="status-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Substituição de fecho tático, revisão geral..."
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
              {isSubmitting ? "Atualizando..." : "Confirmar Alteração"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
