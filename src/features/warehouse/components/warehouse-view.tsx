"use client";

import React, { useState } from "react";
import { useWarehouseData } from "../hooks/use-warehouse-data";
import { MaterialsCatalogView } from "./materials-catalog-view";
import { BatchesTableView } from "./batches-table-view";
import { MovementsLedgerView } from "./movements-ledger-view";
import { EquipmentCatalogView } from "./equipment-catalog-view";
import { CustodyListView } from "./custody-list-view";
import { InventorySessionsListView } from "./inventory-sessions-list-view";
import { WarehouseOverviewView } from "./warehouse-overview-view";
import { WarehouseHeader } from "./warehouse-header";
import { EntryDialog } from "./entry-dialog";
import { MaterialFormDialog } from "./material-form-dialog";
import { EquipmentFormDialog } from "./equipment-form-dialog";
import { OpenInventoryDialog } from "./open-inventory-dialog";
import { exportTableToCsv } from "./warehouse-export";
import { resolveWarehousePermissions } from "../hooks/use-warehouse-permissions";
import { deriveInventoryCategories } from "../domain/inventory-categories";

export type WarehouseSection =
  | "overview"
  | "materials"
  | "batches"
  | "equipment"
  | "custody"
  | "movements"
  | "inventory";

export function WarehouseView({ section }: { section: WarehouseSection }) {
  const warehouseData = useWarehouseData();
  const { materials, batches, equipment, custodies, movements, locations, status, error, canAuditSessions } =
    warehouseData;
  const perms = resolveWarehousePermissions(warehouseData.permissions);
  const canAudit = (canAuditSessions ?? false) && perms.canAudit;

  // Dialog states
  const [isEntryOpen, setIsEntryOpen] = useState(false);
  const [isNewMaterialOpen, setIsNewMaterialOpen] = useState(false);
  const [isNewEquipmentOpen, setIsNewEquipmentOpen] = useState(false);
  const [isNewInventoryOpen, setIsNewInventoryOpen] = useState(false);

  // Categories list
  const materialCategories = React.useMemo(() => {
    const map = new Map<string, string>();
    materials.forEach((m) => {
      if (m.category_id && m.category_name) {
        map.set(m.category_id, m.category_name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [materials]);

  // F07: categorias reais (derivadas de materiais ativos) para inventario por categoria.
  const inventoryCategories = React.useMemo(() => deriveInventoryCategories(materials), [materials]);

  const equipmentCategories = React.useMemo(() => {
    const map = new Map<string, string>();
    equipment.forEach((e) => {
      if (e.category_id && e.category_name) {
        map.set(e.category_id, e.category_name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [equipment]);

  // Handle Export Report (Non-mutating client CSV export)
  const handleExportReport = () => {
    const timestamp = new Date().toISOString().split("T")[0];

    switch (section) {
      case "materials": {
        const headers = ["ID", "Nome", "Categoria", "Unidade", "ON-HAND", "Mínimo", "Ativo"];
        const rows = materials.map((m) => [
          m.id,
          m.name,
          m.category_name || m.category_id,
          m.unit,
          m.current_quantity,
          m.minimum_quantity,
          m.active ? "Sim" : "Não",
        ]);
        exportTableToCsv(`almoxarifado-materiais-${timestamp}`, headers, rows);
        break;
      }
      case "batches": {
        const headers = ["Lote", "Material", "Validade", "Saldo Atual", "Qtd Inicial", "Status", "Fornecedor"];
        const rows = batches.map((b) => [
          b.lot_number,
          b.material_name,
          b.expiration_date,
          b.current_quantity,
          b.initial_quantity,
          b.status,
          b.supplier_name || "—",
        ]);
        exportTableToCsv(`almoxarifado-lotes-fefo-${timestamp}`, headers, rows);
        break;
      }
      case "equipment": {
        const headers = ["Patrimônio", "Nome", "Categoria", "Estado", "Status", "Localização", "Série"];
        const rows = equipment.map((e) => [
          e.identifier_code,
          e.name,
          e.category_name || e.category_id,
          e.condition,
          e.status,
          e.current_location_name || "—",
          e.serial_number || "—",
        ]);
        exportTableToCsv(`almoxarifado-equipamentos-${timestamp}`, headers, rows);
        break;
      }
      case "custody": {
        const headers = ["Equipamento", "Código", "Policial / RA", "Despachado Por", "Data Saída", "Previsão Retorno", "Status"];
        const rows = custodies.map((c) => [
          c.equipment_name,
          c.equipment_code,
          `${c.borrower_name} (${c.borrower_ra})`,
          `${c.dispatched_by_name} (${c.dispatched_by_ra})`,
          c.dispatched_at ? new Date(c.dispatched_at).toLocaleDateString("pt-BR") : "—",
          c.expected_return_at ? new Date(c.expected_return_at).toLocaleDateString("pt-BR") : "—",
          c.status,
        ]);
        exportTableToCsv(`almoxarifado-cautelas-${timestamp}`, headers, rows);
        break;
      }
      case "movements": {
        const headers = ["Data/Hora", "Tipo", "Material", "Lote", "Quantidade", "Unidade", "Responsável", "Motivo"];
        const rows = movements.map((m) => [
          m.performed_at ? new Date(m.performed_at).toLocaleString("pt-BR") : "—",
          m.type,
          m.material_name,
          m.lot_number || "—",
          m.quantity,
          m.unit,
          `${m.performed_by_name} (${m.performed_by_ra})`,
          m.reason,
        ]);
        exportTableToCsv(`almoxarifado-movimentacoes-${timestamp}`, headers, rows);
        break;
      }
      default: {
        const headers = ["Métrica", "Valor"];
        const rows = [
          ["Total Materiais Ativos", materials.filter((m) => m.active).length],
          ["Total Lotes Ativos", batches.filter((b) => b.status === "active").length],
          ["Equipamentos em Cautela", custodies.filter((c) => c.status === "active").length],
          ["Movimentações Registradas", movements.length],
        ];
        exportTableToCsv(`almoxarifado-visao-geral-${timestamp}`, headers, rows);
        break;
      }
    }
  };

  return (
    <div className="space-y-6" data-testid="warehouse-view">
      {/* Unified K9 Ops Header & Pill Tabs (Matching Mockups 1 & 2) */}
      <WarehouseHeader
        section={section}
        onExportReport={perms.canExport ? handleExportReport : undefined}
        onRegisterEntry={perms.canCreate ? () => setIsEntryOpen(true) : undefined}
        onNewMaterial={section === "materials" && perms.canCreate ? () => setIsNewMaterialOpen(true) : undefined}
        onNewEquipment={section === "equipment" && perms.canCreate ? () => setIsNewEquipmentOpen(true) : undefined}
        onNewInventory={section === "inventory" && canAudit ? () => setIsNewInventoryOpen(true) : undefined}
      />

      {status === "loading" && (
        <div
          role="status"
          className="rounded-3xl border border-cyan-200/10 bg-[#0b1628]/82 p-12 text-center text-slate-400 shadow-[0_24px_80px_rgba(0,0,0,0.24)]"
        >
          <p className="animate-pulse text-sm">Carregando dados operacionais do almoxarifado…</p>
        </div>
      )}

      {status === "forbidden" && (
        <div role="alert" className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-300 shadow-xl">
          <h2 className="text-base font-bold text-rose-200">Acesso Restrito ao Almoxarifado</h2>
          <p className="mt-1 text-xs">
            Seu perfil não possui a permissão necessária (inventory.view) para visualizar esta seção.
          </p>
        </div>
      )}

      {status === "error" && (
        <div role="alert" className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-300 shadow-xl">
          <h2 className="text-base font-bold text-rose-200">Falha ao Carregar Almoxarifado</h2>
          <p className="mt-1 text-xs text-rose-300">
            Não foi possível carregar os registros do sistema: {error}
          </p>
        </div>
      )}

      {status === "ready" && (
        <div className="pt-1">
          {section === "overview" && <WarehouseOverviewView />}
          {section === "materials" && <MaterialsCatalogView />}
          {section === "batches" && <BatchesTableView />}
          {section === "movements" && <MovementsLedgerView />}
          {section === "equipment" && <EquipmentCatalogView />}
          {section === "custody" && <CustodyListView />}
          {section === "inventory" && (
            canAudit ? (
              <InventorySessionsListView />
            ) : (
              <div
                role="alert"
                className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-6 text-amber-200 shadow-xl"
                data-testid="inventory-section-restricted"
              >
                <h2 className="text-base font-bold text-amber-100">Acesso Restrito ao Inventário Físico</h2>
                <p className="mt-1 text-xs text-amber-200/90">
                  Seu perfil possui acesso operacional ao almoxarifado, mas a visualização e gestão de sessões de auditoria física de estoque é restrita à administração e almoxarifado (permissão inventory.audit).
                </p>
              </div>
            )
          )}
        </div>
      )}

      {/* Entry Dialog */}
      <EntryDialog
        isOpen={isEntryOpen}
        onClose={() => setIsEntryOpen(false)}
        materials={materials}
        locations={locations}
      />

      {/* Material Form Dialog */}
      <MaterialFormDialog
        isOpen={isNewMaterialOpen}
        onClose={() => setIsNewMaterialOpen(false)}
        categories={materialCategories}
      />

      {/* Equipment Form Dialog */}
      <EquipmentFormDialog
        isOpen={isNewEquipmentOpen}
        onClose={() => setIsNewEquipmentOpen(false)}
        locations={locations}
        categories={equipmentCategories}
      />

      {/* Inventory Dialog */}
      <OpenInventoryDialog
        isOpen={isNewInventoryOpen}
        onClose={() => setIsNewInventoryOpen(false)}
        locations={locations}
        categories={inventoryCategories}
      />
    </div>
  );
}
