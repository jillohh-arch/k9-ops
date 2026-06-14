"use client";

import {
  Archive,
  Building2,
  CalendarClock,
  Check,
  Clock,
  Edit2,
  LoaderCircle,
  Plus,
  Search,
  Sun,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/form/form-primitives";
import { textareaClass } from "@/components/form/form-classes";
import { useShiftGroups } from "@/features/effective/hooks/use-shift-groups";
import {
  archiveShiftGroup,
  saveShiftGroup,
  type ShiftGroup,
  type ShiftGroupFormValues,
} from "@/features/effective/data/shift-group-service";
import { paths } from "@/lib/routes/paths";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type DialogMode = "create" | "edit" | null;

type ShiftGroupFormState = {
  name: string;
  type: "operational" | "administrative";
  expectedStartHour: number;
  expectedEndHour: number;
  municipality: string;
};

const emptyForm: ShiftGroupFormState = {
  name: "",
  type: "operational",
  expectedStartHour: 7,
  expectedEndHour: 19,
  municipality: "limeira",
};

// ─── Dialog ───────────────────────────────────────────────────────────────────

function ShiftGroupDialog({
  group,
  mode,
  onClose,
  onSave,
}: {
  group: ShiftGroup | null;
  mode: DialogMode;
  onClose: () => void;
  onSave: (values: ShiftGroupFormValues, id?: string) => Promise<void>;
}) {
  const [form, setForm] = useState<ShiftGroupFormState>(
    group ?? emptyForm,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "edit" && group) {
      setForm({
        name: group.name,
        type: group.type,
        expectedStartHour: group.expectedStartHour,
        expectedEndHour: group.expectedEndHour,
        municipality: group.municipality,
      });
    } else if (mode === "create") {
      setForm(emptyForm);
    }
  }, [mode, group]);

  if (!mode) return null;

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError("Informe o nome do plantão.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onSave(form, group?.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-cyan-200/20 bg-[#0b1628] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">
            {mode === "create" ? "Novo Plantão" : "Editar Plantão"}
          </h2>
          <button
            className="rounded-xl border border-white/10 bg-white/[0.05] p-2 text-slate-400 transition hover:border-white/20 hover:text-white"
            onClick={onClose}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 space-y-4">
          {error && (
            <div className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Nome do Plantão
            </label>
            <input
              className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.035] px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-white/[0.05]"
              placeholder="Ex: Plantão Alfa"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Tipo
            </label>
            <div className="flex gap-3">
              <button
                className={cn(
                  "flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition",
                  form.type === "operational"
                    ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-100"
                    : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20",
                )}
                onClick={() => setForm({ ...form, type: "operational" })}
                type="button"
              >
                <Clock className="mr-2 inline h-4 w-4" />
                Operacional
              </button>
              <button
                className={cn(
                  "flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition",
                  form.type === "administrative"
                    ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-100"
                    : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20",
                )}
                onClick={() => setForm({ ...form, type: "administrative" })}
                type="button"
              >
                <Building2 className="mr-2 inline h-4 w-4" />
                Administrativo
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Início (hora)
              </label>
              <input
                className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.035] px-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/35"
                max={23}
                min={0}
                type="number"
                value={form.expectedStartHour}
                onChange={(e) =>
                  setForm({
                    ...form,
                    expectedStartHour: Number(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Fim (hora)
              </label>
              <input
                className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.035] px-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/35"
                max={23}
                min={0}
                type="number"
                value={form.expectedEndHour}
                onChange={(e) =>
                  setForm({
                    ...form,
                    expectedEndHour: Number(e.target.value),
                  })
                }
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Município
            </label>
            <input
              className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.035] px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35"
              placeholder="Ex: Limeira"
              value={form.municipality}
              onChange={(e) =>
                setForm({ ...form, municipality: e.target.value })
              }
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={loading} onClick={handleSave} variant="primary">
            {loading ? (
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            {mode === "create" ? "Criar Plantão" : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Shift Card ───────────────────────────────────────────────────────────────

function ShiftCard({
  group,
  onEdit,
  onArchive,
}: {
  group: ShiftGroup & { memberCount: number };
  onEdit: (g: ShiftGroup) => void;
  onArchive: (g: ShiftGroup) => void;
}) {
  const isOvernight = group.expectedStartHour > group.expectedEndHour;

  return (
    <article className="rounded-2xl border border-white/8 bg-white/[0.025] p-5 transition hover:border-cyan-300/20">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-2xl border",
              group.type === "operational"
                ? "border-cyan-300/25 bg-cyan-300/10 text-cyan-200"
                : "border-amber-300/25 bg-amber-300/10 text-amber-200",
            )}
          >
            {group.type === "operational" ? (
              <Sun className="h-6 w-6" />
            ) : (
              <Building2 className="h-6 w-6" />
            )}
          </span>
          <div>
            <h3 className="font-bold text-white">{group.name}</h3>
            <p className="mt-0.5 text-sm text-slate-400">
              {group.municipality}
            </p>
          </div>
        </div>
        <Badge tone={group.type === "operational" ? "cyan" : "yellow"}>
          {group.type === "operational" ? "Operacional" : "Administrativo"}
        </Badge>
      </div>

      <div className="mt-4 flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2 text-slate-300">
          <CalendarClock className="h-4 w-4 text-slate-500" />
          <span className="font-mono">
            {String(group.expectedStartHour).padStart(2, "0")}:00
            {" – "}
            {String(group.expectedEndHour).padStart(2, "0")}:00
            {isOvernight && " (+1 dia)"}
          </span>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
        <Users className="h-4 w-4" />
        <span>
          {group.memberCount}{" "}
          {group.memberCount === 1 ? "GCM atribuído" : "GCMs atribuídos"}
        </span>
      </div>

      <div className="mt-4 flex gap-2 border-t border-white/8 pt-4">
        <button
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-300 transition hover:border-cyan-300/25 hover:text-cyan-100"
          onClick={() => onEdit(group)}
          type="button"
        >
          <Edit2 className="h-3.5 w-3.5" />
          Editar
        </button>
        <button
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-300 transition hover:border-red-300/25 hover:text-red-100"
          onClick={() => onArchive(group)}
          type="button"
        >
          <Archive className="h-3.5 w-3.5" />
          Desativar
        </button>
      </div>
    </article>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ShiftsPage() {
  const { groups, loading, error, refetchCounts } = useShiftGroups();
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [editingGroup, setEditingGroup] = useState<ShiftGroup | null>(null);
  const [search, setSearch] = useState("");

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.toLowerCase();
    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.municipality.toLowerCase().includes(q),
    );
  }, [groups, search]);

  const handleSave = async (values: ShiftGroupFormValues, id?: string) => {
    await saveShiftGroup(values, id);
    await refetchCounts();
  };

  const handleArchive = async (group: ShiftGroup) => {
    if (
      confirm(
        `Desativar o plantão "${group.name}"? GCMs continuarão atribuídos mas não aparecerão na listagem.`,
      )
    ) {
      await archiveShiftGroup(group.id);
      await refetchCounts();
    }
  };

  const handleEdit = (group: ShiftGroup) => {
    setEditingGroup(group);
    setDialogMode("edit");
  };

  const handleCreate = () => {
    setEditingGroup(null);
    setDialogMode("create");
  };

  const handleClose = () => {
    setDialogMode(null);
    setEditingGroup(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-black text-white">Plantões</h1>
          <p className="mt-1 text-sm text-slate-400">
            Cadastro e gestão de plantões da unidade
          </p>
        </div>
        <Button onClick={handleCreate} variant="primary">
          <Plus className="mr-2 h-4 w-4" />
          Novo Plantão
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
        <input
          className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.035] pl-12 pr-4 text-sm text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35"
          placeholder="Buscar plantão..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="rounded-full border border-cyan-300/20 bg-slate-950/90 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-100">
            carregando
          </div>
        </div>
      ) : error ? (
        <Panel title="Erro ao carregar">
          <p className="text-sm text-red-300">{error}</p>
        </Panel>
      ) : filteredGroups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-cyan-200/15 bg-black/16 px-5 py-12 text-center">
          {search ? (
            <p className="text-sm text-slate-400">
              Nenhum plantão encontrado para "{search}"
            </p>
          ) : (
            <>
              <CalendarClock className="mx-auto h-12 w-12 text-slate-600" />
              <p className="mt-3 text-sm text-slate-400">
                Nenhum plantão cadastrado ainda.
              </p>
              <Button className="mt-4" onClick={handleCreate} variant="primary">
                <Plus className="mr-2 h-4 w-4" />
                Criar primeiro plantão
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredGroups.map((group) => (
            <ShiftCard
              key={group.id}
              group={group}
              onArchive={handleArchive}
              onEdit={handleEdit}
            />
          ))}
        </div>
      )}

      {/* Dialog */}
      <ShiftGroupDialog
        group={editingGroup}
        mode={dialogMode}
        onClose={handleClose}
        onSave={handleSave}
      />
    </div>
  );
}
