"use client";

import React, { useState } from "react";
import { WarehouseCategory, WarehouseLocation } from "../domain/contracts";
import { InventoryScopeType } from "../domain/inventory";
import { validateOpenInventoryPayload } from "../domain/inventory";
import { generateWarehouseIdempotencyKey, WarehouseService } from "../data/warehouse-service";

interface OpenInventoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (sessionId: string) => void;
  locations: WarehouseLocation[];
  categories: WarehouseCategory[];
}

export function OpenInventoryDialog({
  isOpen,
  onClose,
  onSuccess,
  locations,
  categories,
}: OpenInventoryDialogProps) {
  const [title, setTitle] = useState("");
  const [scopeType, setScopeType] = useState<InventoryScopeType>("full_warehouse");
  const [scopeRefId, setScopeRefId] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const validationErrors = validateOpenInventoryPayload({
      title,
      scope_type: scopeType,
      scope_ref_id: scopeRefId,
      notes,
    });

    if (Object.keys(validationErrors).length > 0) {
      setErrorMessage(Object.values(validationErrors)[0]);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await WarehouseService.openInventorySession({
        title: title.trim(),
        scope_type: scopeType,
        scope_ref_id: scopeType === "full_warehouse" ? null : scopeRefId,
        scope_label:
          scopeType === "by_location"
            ? locations.find((l) => l.id === scopeRefId)?.name ?? null
            : scopeType === "by_category"
              ? categories.find((c) => c.id === scopeRefId)?.name ?? null
              : null,
        notes: notes.trim() || null,
        idempotency_key: generateWarehouseIdempotencyKey("open-inventory"),
      });

      onClose();
      if (onSuccess) {
        onSuccess(res.session_id);
      }
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || "Falha ao abrir sessão de inventário.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-xl">
        <header className="mb-5">
          <h2 className="text-xl font-bold text-white">Iniciar Nova Sessão de Inventário Físico</h2>
          <p className="mt-1 text-xs text-slate-400">
            A abertura de inventário congelará temporariamente movimentações nas posições incluídas no escopo.
          </p>
        </header>

        {errorMessage && (
          <div role="alert" className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Título da Sessão <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Inventário Geral Q4 2026 ou Contagem Ração Canil"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Escopo da Contagem <span className="text-red-400">*</span>
            </label>
            <select
              value={scopeType}
              onChange={(e) => {
                const nextType = e.target.value as InventoryScopeType;
                setScopeType(nextType);
                setScopeRefId("");
              }}
              className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
            >
              <option value="full_warehouse">Geral (Todo o Almoxarifado)</option>
              <option value="by_location">Por Local Físico</option>
              <option value="by_category">Por Categoria de Material</option>
            </select>
          </div>

          {scopeType === "by_location" && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Selecione o Local <span className="text-red-400">*</span>
              </label>
              <select
                required
                value={scopeRefId}
                onChange={(e) => setScopeRefId(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
              >
                <option value="">Selecione um local...</option>
                {locations.filter((l) => l.active).map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.type})
                  </option>
                ))}
              </select>
            </div>
          )}

          {scopeType === "by_category" && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Selecione a Categoria <span className="text-red-400">*</span>
              </label>
              <select
                required
                value={scopeRefId}
                onChange={(e) => setScopeRefId(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
              >
                <option value="">Selecione uma categoria...</option>
                {categories.filter((c) => c.active).map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Notas / Observações Operacionais
            </label>
            <textarea
              rows={2}
              placeholder="Instruções para conferentes, motivos do inventário, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
            />
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="rounded-lg border border-white/10 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-white/5"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
            >
              {isSubmitting ? "Iniciando..." : "Iniciar Sessão"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
