"use client";

import React, { useState } from "react";
import { Equipment } from "../domain/contracts";
import { WarehouseService } from "../data/warehouse-service";

interface RetireEquipmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  equipment: Equipment;
}

export function RetireEquipmentDialog({
  isOpen,
  onClose,
  onSuccess,
  equipment,
}: RetireEquipmentDialogProps) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const isInCustody = equipment.status === "in_custody";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (isInCustody) {
      setErrorMessage(
        "Não é permitido aposentar equipamento em cautela ativa. Proceda com a devolução antes de efetuar a baixa patrimonial.",
      );
      return;
    }

    if (!reason.trim()) {
      setErrorMessage("Justificativa de baixa/aposentadoria é obrigatória.");
      return;
    }

    setIsSubmitting(true);
    try {
      await WarehouseService.retireEquipment({
        equipment_id: equipment.id,
        reason: reason.trim(),
      });

      onClose();
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Erro ao baixar equipamento.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="retire-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto"
    >
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl text-white my-8">
        <header className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-rose-400">Baixa Patrimonial</p>
          <h2 id="retire-dialog-title" className="text-xl font-bold text-rose-300">
            Aposentar / Baixar Equipamento
          </h2>
          <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
            <span className="font-semibold text-white">{equipment.name}</span>
            <span className="text-slate-400 ml-2">({equipment.identifier_code})</span>
            <div className="mt-1 text-xs text-slate-300">
              Status atual: <strong className="text-cyan-300">{equipment.status}</strong>
            </div>
          </div>
        </header>

        {isInCustody && (
          <div role="alert" className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            <strong>Ação bloqueada:</strong> Este equipamento está em cautela ativa. Não é permitido aposentar um bem que ainda não foi recolhido ao almoxarifado.
          </div>
        )}

        {errorMessage && (
          <div role="alert" className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="retire-reason" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Motivo da Baixa Patrimonial *
            </label>
            <textarea
              id="retire-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isInCustody}
              placeholder="Ex: Inutilização por dano irreparável, fim da vida útil, leilão..."
              required
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-rose-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
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
              disabled={isSubmitting || isInCustody}
              className="rounded-xl bg-rose-600 px-5 py-2 text-sm font-bold text-white hover:bg-rose-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Baixando..." : "Confirmar Baixa"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
