"use client";

import {
  AlertTriangle,
  Archive,
  ArrowDownCircle,
  ArrowUpCircle,
  Boxes,
  CheckCircle2,
  ClipboardList,
  LoaderCircle,
  PackagePlus,
  Plus,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Tag,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

import { useAccessControl } from "@/features/access/providers/access-control-provider";
import {
  archiveInventoryItem,
  createInventoryMovement,
  emptyInventoryCategoryFormValues,
  emptyInventoryItemFormValues,
  emptyInventoryMovementFormValues,
  saveInventoryCategory,
  saveInventoryItem,
  seedInventoryDefaults,
  type InventoryCategoryFormValues,
  type InventoryItemFormValues,
  type InventoryMovementFormValues,
} from "@/features/inventory/data/inventory-admin-service";
import { useEffectiveData } from "@/features/effective/hooks/use-effective-data";
import {
  inventoryMovementLabel,
  inventoryStatusLabel,
  type InventoryItem,
  useInventoryData,
} from "@/features/inventory/hooks/use-inventory-data";
import { cn } from "@/lib/utils";

const inputClass =
  "h-11 w-full rounded-xl border border-white/10 bg-white/[0.035] px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35";

const selectClass =
  "h-11 w-full rounded-xl border border-white/10 bg-white/[0.035] px-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/35";

const textareaClass =
  "min-h-24 w-full rounded-xl border border-white/10 bg-white/[0.035] px-3 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35";

const inventoryUnits = [
  "kg",
  "pacote",
  "unidade",
  "caixa",
  "frasco",
  "comprimido",
  "metro",
  "par",
];

const movementTypes = [
  { id: "entrada", label: "Entrada", icon: ArrowUpCircle },
  { id: "saida", label: "Saída", icon: ArrowDownCircle },
  { id: "ajuste", label: "Ajuste", icon: RotateCcw },
  { id: "perda", label: "Perda", icon: AlertTriangle },
  { id: "descarte", label: "Descarte", icon: Trash2 },
  { id: "vencimento", label: "Vencimento", icon: Archive },
];

type InventoryTab = "items" | "movements" | "catalog";

const inventoryTabs: Array<{
  description: string;
  id: InventoryTab;
  label: string;
}> = [
  {
    description: "consulta de saldos e alertas",
    id: "items",
    label: "Consulta",
  },
  {
    description: "entradas, saídas e ajustes",
    id: "movements",
    label: "Movimentação",
  },
  {
    description: "itens e categorias",
    id: "catalog",
    label: "Cadastro",
  },
];

function numberText(value: number, unit?: string) {
  const formatted = new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
  }).format(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

function dateText(date: Date | null) {
  if (!date) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function statusTone(status: string) {
  if (status === "active") return "border-emerald-300/20 bg-emerald-300/10 text-emerald-200";
  if (status === "low_stock") return "border-amber-300/20 bg-amber-300/10 text-amber-200";
  if (status === "out_of_stock" || status === "expired") {
    return "border-red-300/20 bg-red-300/10 text-red-200";
  }
  return "border-slate-300/20 bg-slate-300/10 text-slate-300";
}

function Field({
  children,
  hint,
  label,
  required,
}: {
  children: React.ReactNode;
  hint?: string;
  label: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
        {label} {required ? <span className="text-cyan-300">*</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

function StatCard({
  detail,
  icon: Icon,
  tone = "cyan",
  title,
  value,
}: {
  detail: string;
  icon: typeof Boxes;
  tone?: "amber" | "cyan" | "emerald" | "red";
  title: string;
  value: string;
}) {
  const tones = {
    amber: "border-amber-300/20 bg-amber-300/10 text-amber-200",
    cyan: "border-cyan-300/20 bg-cyan-300/10 text-cyan-200",
    emerald: "border-emerald-300/20 bg-emerald-300/10 text-emerald-200",
    red: "border-red-300/20 bg-red-300/10 text-red-200",
  };
  return (
    <div className="relative overflow-hidden rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
      <div className="absolute right-0 top-0 h-24 w-24 rounded-bl-full bg-cyan-300/[0.035]" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-300">{title}</p>
          <p className="mt-5 text-4xl font-black text-white">{value}</p>
          <p className="mt-2 text-sm text-slate-500">{detail}</p>
        </div>
        <span className={cn("rounded-2xl border p-3", tones[tone])}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

function itemToForm(item: InventoryItem): InventoryItemFormValues {
  return {
    active: item.active,
    brand: item.brand ?? "",
    categoryId: item.categoryId,
    categoryName: item.categoryName,
    description: item.description ?? "",
    documentUrl: item.documentUrl ?? "",
    expirationDate: item.expirationDateText ?? "",
    initialQuantity: "",
    lot: item.lot ?? "",
    minimumQuantity: String(item.minimumQuantity),
    name: item.name,
    notes: item.description ?? "",
    photoUrl: item.photoUrl ?? "",
    storageLocation: item.storageLocation ?? "",
    supplierName: item.supplierName ?? "",
    unit: item.unit,
  };
}

export default function InventoryPage() {
  const { can } = useAccessControl();
  const { categories, error, items, loading, movements, summary } =
    useInventoryData();
  const { dogs, users } = useEffectiveData();
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [itemMode, setItemMode] = useState<"create" | "edit">("create");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemValues, setItemValues] = useState<InventoryItemFormValues>(
    emptyInventoryItemFormValues,
  );
  const [movementValues, setMovementValues] =
    useState<InventoryMovementFormValues>(emptyInventoryMovementFormValues);
  const [categoryValues, setCategoryValues] =
    useState<InventoryCategoryFormValues>(emptyInventoryCategoryFormValues);
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [savingItem, setSavingItem] = useState(false);
  const [savingMovement, setSavingMovement] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [activeTab, setActiveTab] = useState<InventoryTab>("items");

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesQuery =
        !normalizedQuery ||
        [item.name, item.categoryName, item.supplierName, item.brand, item.lot]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedQuery));
      const matchesCategory =
        categoryFilter === "all" || item.categoryId === categoryFilter;
      const matchesStatus =
        statusFilter === "all" || item.status === statusFilter;
      return matchesQuery && matchesCategory && matchesStatus;
    });
  }, [categoryFilter, items, query, statusFilter]);

  const selectedMovementItem = items.find(
    (item) => item.id === movementValues.itemId,
  );
  const canCreateInventory = can("inventory", "create");
  const canEditInventory = can("inventory", "edit");
  const canArchiveInventory = can("inventory", "archive");
  const canSaveInventoryItem =
    itemMode === "create" ? canCreateInventory : canEditInventory;

  function setItemField<K extends keyof InventoryItemFormValues>(
    field: K,
    value: InventoryItemFormValues[K],
  ) {
    setItemValues((current) => ({ ...current, [field]: value }));
  }

  function setMovementField<K extends keyof InventoryMovementFormValues>(
    field: K,
    value: InventoryMovementFormValues[K],
  ) {
    setMovementValues((current) => ({ ...current, [field]: value }));
  }

  function startNewItem() {
    if (!canCreateInventory) {
      setFormError("Seu perfil não permite cadastrar itens de estoque.");
      return;
    }
    setActiveTab("catalog");
    setItemMode("create");
    setEditingItemId(null);
    setItemValues({
      ...emptyInventoryItemFormValues,
      categoryId: categories[0]?.id ?? "alimentacao",
      categoryName: categories[0]?.name ?? "Alimentação",
    });
    setFormError(null);
  }

  function startEditItem(item: InventoryItem) {
    if (!canEditInventory) {
      setFormError("Seu perfil não permite editar itens de estoque.");
      return;
    }
    setActiveTab("catalog");
    setItemMode("edit");
    setEditingItemId(item.id);
    setItemValues(itemToForm(item));
    setFormError(null);
    window.scrollTo({ behavior: "smooth", top: 0 });
  }

  function startMovement(item: InventoryItem, type = "saida") {
    if (!canCreateInventory) {
      setFormError("Seu perfil não permite registrar movimentações de estoque.");
      return;
    }
    setActiveTab("movements");
    setMovementValues({
      ...emptyInventoryMovementFormValues,
      itemId: item.id,
      type,
      unit: item.unit,
    });
    window.scrollTo({ behavior: "smooth", top: 0 });
  }

  async function handleSeedDefaults() {
    if (!canCreateInventory) {
      setFormError("Seu perfil não permite conferir/criar categorias.");
      return;
    }
    setSeeding(true);
    setFormError(null);
    try {
      const seeded = await seedInventoryDefaults();
      setMessage(`${seeded} categorias padrão conferidas no Firebase.`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSeeding(false);
    }
  }

  async function handleSaveCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCreateInventory) {
      setFormError("Seu perfil não permite criar categorias de estoque.");
      return;
    }
    if (!categoryValues.name.trim()) {
      setFormError("Informe o nome da categoria.");
      return;
    }
    setSavingCategory(true);
    setFormError(null);
    try {
      await saveInventoryCategory("create", categoryValues);
      setCategoryValues(emptyInventoryCategoryFormValues);
      setMessage("Categoria salva.");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingCategory(false);
    }
  }

  async function handleSaveItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSaveInventoryItem) {
      setFormError(
        itemMode === "create"
          ? "Seu perfil não permite cadastrar itens de estoque."
          : "Seu perfil não permite editar itens de estoque.",
      );
      return;
    }
    if (!itemValues.name.trim()) {
      setFormError("Informe o nome do item.");
      return;
    }
    if (!itemValues.categoryId || !itemValues.categoryName || !itemValues.unit) {
      setFormError("Informe categoria e unidade.");
      return;
    }
    setSavingItem(true);
    setFormError(null);
    try {
      await saveInventoryItem(itemMode, itemValues, editingItemId ?? undefined);
      setMessage(itemMode === "create" ? "Item cadastrado." : "Item atualizado.");
      startNewItem();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingItem(false);
    }
  }

  async function handleArchiveItem(item: InventoryItem) {
    if (!canArchiveInventory) {
      setFormError("Seu perfil não permite arquivar itens de estoque.");
      return;
    }
    const reason = window.prompt(`Motivo para arquivar ${item.name}:`);
    if (!reason?.trim()) return;
    setFormError(null);
    try {
      await archiveInventoryItem(item.id, reason);
      setMessage("Item arquivado.");
      if (editingItemId === item.id) startNewItem();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleCreateMovement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCreateInventory) {
      setFormError("Seu perfil não permite registrar movimentações de estoque.");
      return;
    }
    if (!movementValues.itemId) {
      setFormError("Selecione o item movimentado.");
      return;
    }
    if (!movementValues.quantity.trim() || !movementValues.reason.trim()) {
      setFormError("Informe quantidade e motivo da movimentação.");
      return;
    }
    setSavingMovement(true);
    setFormError(null);
    try {
      const response = await createInventoryMovement(movementValues);
      setMessage(
        `Movimentação registrada. Saldo atual: ${numberText(
          Number(response.balance_after ?? 0),
          movementValues.unit,
        )}.`,
      );
      setMovementValues(emptyInventoryMovementFormValues);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingMovement(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
            Estoque
          </p>
          <h1 className="mt-2 text-3xl font-black text-white md:text-4xl">
            Controle de insumos K9
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Cadastre itens, registre entradas e saídas auditáveis e acompanhe
            saldo mínimo, validade e consumo operacional.
          </p>
        </div>
        {canCreateInventory ? (
          <button
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.07] px-5 py-3 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-300/[0.12]"
            disabled={seeding}
            onClick={handleSeedDefaults}
            type="button"
          >
            {seeding ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Tag className="h-4 w-4" />}
            Conferir categorias
          </button>
        ) : null}
      </div>

      {error || formError || message ? (
        <div
          className={cn(
            "rounded-2xl border px-4 py-3 text-sm",
            formError || error
              ? "border-red-300/15 bg-red-300/[0.04] text-red-200"
              : "border-emerald-300/15 bg-emerald-300/[0.04] text-emerald-200",
          )}
        >
          {formError ?? error ?? message}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          detail="itens ativos cadastrados"
          icon={Boxes}
          title="Itens no estoque"
          value={loading ? "..." : String(summary.activeItems.length)}
        />
        <StatCard
          detail="baixo, zerado ou vencido"
          icon={AlertTriangle}
          title="Críticos"
          tone={summary.criticalItems.length ? "red" : "emerald"}
          value={loading ? "..." : String(summary.criticalItems.length)}
        />
        <StatCard
          detail="vencem nos próximos 30 dias"
          icon={ClipboardList}
          title="Validade próxima"
          tone={summary.expiringItems.length ? "amber" : "cyan"}
          value={loading ? "..." : String(summary.expiringItems.length)}
        />
        <StatCard
          detail="somatorio de saídas/perdas"
          icon={ArrowDownCircle}
          title="Consumo 30 dias"
          tone="amber"
          value={loading ? "..." : numberText(summary.outgoingLast30)}
        />
      </section>

      <nav className="grid gap-3 md:grid-cols-3">
        {inventoryTabs.map((tab) => (
          <button
            className={cn(
              "rounded-2xl border px-4 py-3 text-left transition",
              activeTab === tab.id
                ? "border-cyan-300/35 bg-cyan-300/12 text-cyan-100"
                : "border-white/10 bg-white/[0.035] text-slate-400 hover:border-cyan-300/25 hover:text-slate-100",
            )}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            <span className="block text-sm font-black">{tab.label}</span>
            <span className="mt-1 block text-xs text-slate-500">
              {tab.description}
            </span>
          </button>
        ))}
      </nav>

      <section
        className={cn(
          "grid gap-6",
          activeTab === "items"
            ? "xl:grid-cols-1"
            : "xl:grid-cols-[minmax(0,1fr)_420px]",
        )}
      >
        <div
          className={cn("space-y-5", activeTab === "catalog" && "hidden")}
        >
          <div
            className={cn(
              "rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-5",
              activeTab !== "items" && "hidden",
            )}
          >
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
              <div>
                <h2 className="text-xl font-black text-white">Itens cadastrados</h2>
                <p className="text-sm text-slate-500">
                  Saldo atual calculado por movimentações.
                </p>
              </div>
              {canCreateInventory ? (
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-[0_0_24px_rgba(77,208,225,0.24)] hover:bg-cyan-200"
                  onClick={startNewItem}
                  type="button"
                >
                  <Plus className="h-4 w-4" />
                  Novo item
                </button>
              ) : null}
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px]">
              <label className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  className={cn(inputClass, "pl-10")}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por item, lote, fornecedor..."
                  value={query}
                />
              </label>
              <select
                className={selectClass}
                onChange={(event) => setCategoryFilter(event.target.value)}
                value={categoryFilter}
              >
                <option className="bg-[#0b1628]" value="all">Todas categorias</option>
                {categories.map((category) => (
                  <option className="bg-[#0b1628]" key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <select
                className={selectClass}
                onChange={(event) => setStatusFilter(event.target.value)}
                value={statusFilter}
              >
                <option className="bg-[#0b1628]" value="all">Todos status</option>
                <option className="bg-[#0b1628]" value="active">Regular</option>
                <option className="bg-[#0b1628]" value="low_stock">Estoque baixo</option>
                <option className="bg-[#0b1628]" value="out_of_stock">Sem saldo</option>
                <option className="bg-[#0b1628]" value="expired">Vencido</option>
              </select>
            </div>

            <div className="mt-5 space-y-3">
              {filteredItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
                  Nenhum item encontrado. Cadastre o primeiro insumo do canil.
                </div>
              ) : (
                filteredItems.map((item) => (
                  <article
                    className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 transition hover:border-cyan-300/20 hover:bg-white/[0.04]"
                    key={item.id}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-black text-white">{item.name}</h3>
                          <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-black", statusTone(item.status))}>
                            {inventoryStatusLabel(item.status)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          {item.categoryName}
                          {item.storageLocation ? ` · ${item.storageLocation}` : ""}
                          {item.supplierName ? ` · ${item.supplierName}` : ""}
                        </p>
                      </div>
                      <div className="grid gap-3 text-sm sm:grid-cols-3 lg:min-w-[360px]">
                        <div>
                          <p className="text-slate-500">Saldo</p>
                          <p className="font-mono text-xl font-black text-cyan-200">
                            {numberText(item.currentQuantity, item.unit)}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500">Mínimo</p>
                          <p className="font-mono font-bold text-slate-200">
                            {numberText(item.minimumQuantity, item.unit)}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500">Validade</p>
                          <p className="font-mono font-bold text-slate-200">
                            {dateText(item.expirationDate)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {canEditInventory ? (
                        <button
                          className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07] px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-300/[0.12]"
                          onClick={() => startEditItem(item)}
                          type="button"
                        >
                          Editar item
                        </button>
                      ) : null}
                      {canCreateInventory ? (
                        <>
                          <button
                            className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-bold text-emerald-200"
                            onClick={() => startMovement(item, "entrada")}
                            type="button"
                          >
                            Entrada
                          </button>
                          <button
                            className="rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs font-bold text-amber-200"
                            onClick={() => startMovement(item, "saida")}
                            type="button"
                          >
                            Saída
                          </button>
                        </>
                      ) : null}
                      {canArchiveInventory ? (
                        <button
                          className="rounded-xl border border-red-400/25 bg-red-400/10 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-400/[0.18]"
                          onClick={() => handleArchiveItem(item)}
                          type="button"
                        >
                          Arquivar
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>

          <div
            className={cn(
              "rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-5",
              activeTab !== "movements" && "hidden",
            )}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-white">Movimentações recentes</h2>
                <p className="text-sm text-slate-500">
                  Histórico auditável das entradas e saídas.
                </p>
              </div>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-slate-400">
                {movements.length} registros
              </span>
            </div>
            <div className="mt-5 space-y-3">
              {movements.slice(0, 8).map((movement) => (
                <div
                  className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4 md:grid-cols-[1fr_auto]"
                  key={movement.id}
                >
                  <div>
                    <p className="font-bold text-white">
                      {inventoryMovementLabel(movement.type)} · {movement.itemName}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {movement.reason}
                      {movement.dogName ? ` · K9 ${movement.dogName}` : ""}
                      {movement.relatedUserName ? ` · ${movement.relatedUserName}` : ""}
                    </p>
                  </div>
                  <div className="text-left md:text-right">
                    <p
                      className={cn(
                        "font-mono text-lg font-black",
                        movement.delta >= 0 ? "text-emerald-200" : "text-amber-200",
                      )}
                    >
                      {movement.delta >= 0 ? "+" : ""}
                      {numberText(movement.delta, movement.unit)}
                    </p>
                    <p className="font-mono text-xs text-slate-500">
                      {dateText(movement.performedAt)}
                    </p>
                  </div>
                </div>
              ))}
              {movements.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">
                  Nenhuma movimentação registrada ainda.
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <aside className={cn("space-y-5", activeTab === "items" && "hidden")}>
          <form
            className={cn(
              "rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-5",
              activeTab !== "catalog" && "hidden",
            )}
            onSubmit={handleSaveItem}
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-white">
                  {itemMode === "create" ? "Novo item" : "Editar item"}
                </h2>
                <p className="text-sm text-slate-500">
                  Saldo inicial vira movimentação auditada.
                </p>
              </div>
              <span className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-3 text-cyan-200">
                <PackagePlus className="h-5 w-5" />
              </span>
            </div>

            <div className="space-y-4">
              <Field label="Nome do item" required>
                <input
                  className={inputClass}
                  onChange={(event) => setItemField("name", event.target.value)}
                  placeholder="Ex.: Raçao operacional premium"
                  value={itemValues.name}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Categoria" required>
                  <select
                    className={selectClass}
                    onChange={(event) => {
                      const selected = categories.find(
                        (category) => category.id === event.target.value,
                      );
                      setItemValues((current) => ({
                        ...current,
                        categoryId: selected?.id ?? event.target.value,
                        categoryName: selected?.name ?? event.target.value,
                      }));
                    }}
                    value={itemValues.categoryId}
                  >
                    {categories.map((category) => (
                      <option className="bg-[#0b1628]" key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Unidade" required>
                  <select
                    className={selectClass}
                    onChange={(event) => setItemField("unit", event.target.value)}
                    value={itemValues.unit}
                  >
                    {inventoryUnits.map((unit) => (
                      <option className="bg-[#0b1628]" key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Estoque mínimo">
                  <input
                    className={inputClass}
                    inputMode="decimal"
                    onChange={(event) =>
                      setItemField("minimumQuantity", event.target.value)
                    }
                    placeholder="0"
                    value={itemValues.minimumQuantity}
                  />
                </Field>
                <Field
                  hint={itemMode === "edit" ? "Na edição, use movimentação." : undefined}
                  label="Saldo inicial"
                >
                  <input
                    className={inputClass}
                    disabled={itemMode === "edit"}
                    inputMode="decimal"
                    onChange={(event) =>
                      setItemField("initialQuantity", event.target.value)
                    }
                    placeholder="0"
                    value={itemValues.initialQuantity}
                  />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Fornecedor">
                  <input
                    className={inputClass}
                    onChange={(event) =>
                      setItemField("supplierName", event.target.value)
                    }
                    placeholder="Fornecedor"
                    value={itemValues.supplierName}
                  />
                </Field>
                <Field label="Localização">
                  <input
                    className={inputClass}
                    onChange={(event) =>
                      setItemField("storageLocation", event.target.value)
                    }
                    placeholder="Almoxarifado, baia..."
                    value={itemValues.storageLocation}
                  />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Lote">
                  <input
                    className={inputClass}
                    onChange={(event) => setItemField("lot", event.target.value)}
                    placeholder="Lote"
                    value={itemValues.lot}
                  />
                </Field>
                <Field label="Validade">
                  <input
                    className={inputClass}
                    onChange={(event) =>
                      setItemField("expirationDate", event.target.value)
                    }
                    type="date"
                    value={itemValues.expirationDate}
                  />
                </Field>
              </div>
              <Field label="Observações">
                <textarea
                  className={textareaClass}
                  onChange={(event) => setItemField("notes", event.target.value)}
                  placeholder="Detalhes de uso, especificação, restrições..."
                  value={itemValues.notes}
                />
              </Field>
              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-3 text-sm text-slate-300">
                <input
                  checked={itemValues.active}
                  onChange={(event) => setItemField("active", event.target.checked)}
                  type="checkbox"
                />
                Item ativo
              </label>
              <button
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950 shadow-[0_0_24px_rgba(77,208,225,0.24)] hover:bg-cyan-200 disabled:opacity-50"
                disabled={savingItem || !canSaveInventoryItem}
                type="submit"
              >
                {savingItem ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {itemMode === "create" ? "Salvar item" : "Atualizar item"}
              </button>
            </div>
          </form>

          {canCreateInventory ? (
            <form
              className={cn(
                "rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-5",
                activeTab !== "movements" && "hidden",
              )}
              onSubmit={handleCreateMovement}
            >
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-white">Movimentar estoque</h2>
                <p className="text-sm text-slate-500">
                  Entrada, saída ou ajuste com trilha.
                </p>
              </div>
              <span className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-emerald-200">
                <ShieldCheck className="h-5 w-5" />
              </span>
            </div>

            <div className="space-y-4">
              <Field label="Item" required>
                <select
                  className={selectClass}
                  onChange={(event) => {
                    const selected = items.find((item) => item.id === event.target.value);
                    setMovementValues((current) => ({
                      ...current,
                      itemId: event.target.value,
                      unit: selected?.unit ?? current.unit,
                    }));
                  }}
                  value={movementValues.itemId}
                >
                  <option className="bg-[#0b1628]" value="">Selecione</option>
                  {items.map((item) => (
                    <option className="bg-[#0b1628]" key={item.id} value={item.id}>
                      {item.name} · {numberText(item.currentQuantity, item.unit)}
                    </option>
                  ))}
                </select>
              </Field>
              {selectedMovementItem ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3 text-sm text-slate-400">
                  Saldo atual:{" "}
                  <span className="font-mono font-black text-cyan-200">
                    {numberText(selectedMovementItem.currentQuantity, selectedMovementItem.unit)}
                  </span>
                </div>
              ) : null}
              <div className="grid gap-2 sm:grid-cols-3">
                {movementTypes.map((type) => {
                  const Icon = type.icon;
                  const active = movementValues.type === type.id;
                  return (
                    <button
                      className={cn(
                        "inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-black transition",
                        active
                          ? "border-cyan-300/35 bg-cyan-300/15 text-cyan-100"
                          : "border-white/10 bg-white/[0.025] text-slate-400 hover:border-cyan-300/20 hover:text-cyan-100",
                      )}
                      key={type.id}
                      onClick={() => setMovementField("type", type.id)}
                      type="button"
                    >
                      <Icon className="h-4 w-4" />
                      {type.label}
                    </button>
                  );
                })}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  hint={
                    movementValues.type === "ajuste"
                      ? "Use valor positivo ou negativo."
                      : undefined
                  }
                  label="Quantidade"
                  required
                >
                  <input
                    className={inputClass}
                    inputMode="decimal"
                    onChange={(event) =>
                      setMovementField("quantity", event.target.value)
                    }
                    placeholder="0"
                    value={movementValues.quantity}
                  />
                </Field>
                <Field label="Unidade">
                  <input
                    className={inputClass}
                    disabled
                    value={movementValues.unit}
                  />
                </Field>
              </div>
              <Field label="Motivo" required>
                <input
                  className={inputClass}
                  onChange={(event) =>
                    setMovementField("reason", event.target.value)
                  }
                  placeholder="Ex.: consumo operacional, compra, baixa por vencimento"
                  value={movementValues.reason}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="K9 relacionado">
                  <select
                    className={selectClass}
                    onChange={(event) => {
                      const selected = dogs.find((dog) => dog.id === event.target.value);
                      setMovementValues((current) => ({
                        ...current,
                        relatedDogId: selected?.id ?? "",
                        relatedDogName: selected?.name ?? "",
                      }));
                    }}
                    value={movementValues.relatedDogId}
                  >
                    <option className="bg-[#0b1628]" value="">Nenhum</option>
                    {dogs.map((dog) => (
                      <option className="bg-[#0b1628]" key={dog.id} value={dog.id}>
                        {dog.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="GCM relacionado">
                  <select
                    className={selectClass}
                    onChange={(event) => {
                      const selected = users.find((user) => user.ra === event.target.value);
                      setMovementValues((current) => ({
                        ...current,
                        relatedUserName: selected?.callsign ?? "",
                        relatedUserRa: selected?.ra ?? "",
                      }));
                    }}
                    value={movementValues.relatedUserRa}
                  >
                    <option className="bg-[#0b1628]" value="">Nenhum</option>
                    {users.map((user) => (
                      <option className="bg-[#0b1628]" key={user.ra} value={user.ra}>
                        {user.callsign} · {user.ra}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Observações">
                <textarea
                  className={textareaClass}
                  onChange={(event) =>
                    setMovementField("notes", event.target.value)
                  }
                  placeholder="Detalhes da movimentação..."
                  value={movementValues.notes}
                />
              </Field>
              <button
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950 shadow-[0_0_24px_rgba(77,208,225,0.24)] hover:bg-cyan-200 disabled:opacity-50"
                disabled={savingMovement}
                type="submit"
              >
                {savingMovement ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Registrar movimentação
              </button>
            </div>
            </form>
          ) : null}

          {canCreateInventory ? (
            <form
              className={cn(
                "rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-5",
                activeTab !== "catalog" && "hidden",
              )}
              onSubmit={handleSaveCategory}
            >
              <h2 className="text-lg font-black text-white">Nova categoria</h2>
              <p className="mt-1 text-sm text-slate-500">
                Para insumos que não cabem nas categorias padrão.
              </p>
              <div className="mt-4 space-y-3">
                <Field label="Nome">
                  <input
                    className={inputClass}
                    onChange={(event) =>
                      setCategoryValues((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Categoria"
                    value={categoryValues.name}
                  />
                </Field>
                <Field label="Descrição">
                  <input
                    className={inputClass}
                    onChange={(event) =>
                      setCategoryValues((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Uso da categoria"
                    value={categoryValues.description}
                  />
                </Field>
                <button
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950 shadow-[0_0_24px_rgba(77,208,225,0.24)] hover:bg-cyan-200 disabled:opacity-50"
                  disabled={savingCategory}
                  type="submit"
                >
                  {savingCategory ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Salvar categoria
                </button>
              </div>
            </form>
          ) : null}
        </aside>
      </section>
    </div>
  );
}
