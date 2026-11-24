import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/firebase/client", () => ({ db: {}, functions: {} }));

import { WarehouseOverviewView } from "./warehouse-overview-view";
import * as warehouseDataHook from "../hooks/use-warehouse-data";

vi.mock("../hooks/use-warehouse-data");

describe("WarehouseOverviewView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading indicator when status is loading", () => {
    vi.spyOn(warehouseDataHook, "useWarehouseData").mockReturnValue({
      materials: [],
      batches: [],
      positions: [],
      equipment: [],
      custodies: [],
      locations: [],
      movements: [],
      sessions: [],
      status: "loading",
      error: null,
    });

    render(<WarehouseOverviewView />);
    expect(screen.getByRole("status")).toBeDefined();
    expect(screen.getByText(/Carregando visão geral e alertas operacionais/i)).toBeDefined();
  });

  it("renders forbidden alert when user lacks inventory.view permission", () => {
    vi.spyOn(warehouseDataHook, "useWarehouseData").mockReturnValue({
      materials: [],
      batches: [],
      positions: [],
      equipment: [],
      custodies: [],
      locations: [],
      movements: [],
      sessions: [],
      status: "forbidden",
      error: null,
    });

    render(<WarehouseOverviewView />);
    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.getByText(/Acesso não autorizado/i)).toBeDefined();
  });

  it("renders error state when hook encounters an error", () => {
    vi.spyOn(warehouseDataHook, "useWarehouseData").mockReturnValue({
      materials: [],
      batches: [],
      positions: [],
      equipment: [],
      custodies: [],
      locations: [],
      movements: [],
      sessions: [],
      status: "error",
      error: "Falha de rede Firestore",
    });

    render(<WarehouseOverviewView />);
    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.getByText(/Falha de rede Firestore/i)).toBeDefined();
    // Must NOT render healthy empty state on error!
    expect(screen.queryByText(/Nenhuma pendência crítica/i)).toBeNull();
  });

  it("renders healthy calm state when warehouse has no alerts", () => {
    vi.spyOn(warehouseDataHook, "useWarehouseData").mockReturnValue({
      materials: [
        {
          id: "mat-1",
          name: "Ração Canina 15kg",
          category_id: "cat-1",
          category_name: "Alimentos",
          unit: "kg",
          current_quantity: 50,
          minimum_quantity: 10,
          active: true,
        },
      ],
      batches: [
        {
          id: "b-1",
          material_id: "mat-1",
          material_name: "Ração Canina 15kg",
          lot_number: "L-100",
          initial_quantity: 50,
          current_quantity: 50,
          expiration_date: "2029-12-31", // Long validity
          received_at: new Date("2026-01-01"),
          status: "active",
        },
      ],
      positions: [],
      equipment: [
        {
          id: "eq-1",
          name: "Coleira K9",
          category_id: "cat-eq",
          category_name: "Equipamentos",
          identifier_code: "PAT-001",
          condition: "good",
          status: "available",
          current_location_id: "loc-1",
          current_location_name: "Almoxarifado",
          active: true,
        },
      ],
      custodies: [],
      locations: [],
      movements: [],
      sessions: [],
      status: "ready",
      error: null,
    });

    render(<WarehouseOverviewView />);
    expect(screen.getByTestId("healthy-empty-state")).toBeDefined();
    expect(screen.getByText("Nenhuma pendência crítica no almoxarifado.")).toBeDefined();
    expect(screen.getByText("Operação Normal")).toBeDefined();
  });

  it("renders priority alerts and operational attention banner when critical alerts exist", () => {
    vi.spyOn(warehouseDataHook, "useWarehouseData").mockReturnValue({
      materials: [
        {
          id: "mat-oos",
          name: "Vacina Antirrábica",
          category_id: "saude",
          category_name: "Saúde",
          unit: "dose",
          current_quantity: 0,
          minimum_quantity: 10,
          active: true,
        },
      ],
      batches: [],
      positions: [],
      equipment: [
        {
          id: "eq-damaged",
          name: "Colete de Proteção",
          category_id: "cat-eq",
          category_name: "Equipamentos",
          identifier_code: "PAT-DMG-01",
          condition: "damaged",
          status: "damaged",
          current_location_id: "loc-1",
          current_location_name: "Almoxarifado",
          active: true,
        },
      ],
      custodies: [
        {
          id: "cust-overdue",
          equipment_id: "eq-2",
          equipment_name: "Guia Tática",
          equipment_code: "PAT-GUIA-02",
          borrower_ra: "12345",
          borrower_name: "GCM Silva",
          dispatched_by_ra: "999",
          dispatched_by_name: "Chefe Almox",
          dispatched_at: new Date("2026-09-01"),
          condition_at_dispatch: "good",
          purpose: "daily_duty",
          status: "active",
          expected_return_at: new Date("2026-09-05T18:00:00Z"), // Past expected date!
        },
      ],
      locations: [],
      movements: [],
      sessions: [],
      status: "ready",
      error: null,
    });

    render(<WarehouseOverviewView />);
    expect(screen.getByText("Atenção Requerida")).toBeDefined();
    expect(screen.getByTestId("alerts-list")).toBeDefined();
    expect(screen.getByText(/Material sem estoque disponível: Vacina Antirrábica/i)).toBeDefined();
    expect(screen.getByText(/Cautela atrasada: Guia Tática/i)).toBeDefined();
    expect(screen.getByText(/Equipamento danificado: Colete de Proteção/i)).toBeDefined();
  });

  it("renders active inventory callout banner when a session is in progress", () => {
    vi.spyOn(warehouseDataHook, "useWarehouseData").mockReturnValue({
      materials: [],
      batches: [],
      positions: [],
      equipment: [],
      custodies: [],
      locations: [],
      movements: [],
      sessions: [
        {
          id: "inv-active-1",
          title: "Inventário Geral 2026",
          scope_type: "full_warehouse",
          opened_by_ra: "1001",
          opened_by_name: "Inspetor Carlos",
          opened_at: new Date("2026-10-06T08:00:00Z"),
          status: "in_progress",
          total_items: 40,
          counted_items: 25,
        },
      ],
      status: "ready",
      error: null,
    });

    render(<WarehouseOverviewView />);
    expect(screen.getByText(/Inventário Físico: Inventário Geral 2026/i)).toBeDefined();
    expect(screen.getAllByText(/Inspetor Carlos/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/25 de 40 posições contadas/i)).toBeDefined();
    expect(screen.getByRole("link", { name: /Continuar Contagem/i })).toBeDefined();
  });

  it("renders recent stock movements correctly", () => {
    vi.spyOn(warehouseDataHook, "useWarehouseData").mockReturnValue({
      materials: [],
      batches: [],
      positions: [],
      equipment: [],
      custodies: [],
      locations: [],
      movements: [
        {
          id: "mov-1",
          material_id: "m-1",
          material_name: "Ração Premium",
          batch_id: "b-1",
          lot_number: "LT-88",
          type: "entry",
          quantity: 25,
          delta: 25,
          unit: "kg",
          reason: "Recebimento Fornecedor",
          balance_before: 0,
          balance_after: 25,
          performed_by_ra: "123",
          performed_by_name: "GCM Oliveira",
          performed_by_uid: "uid-123",
          performed_at: new Date("2026-10-06T14:30:00Z"),
        },
      ],
      sessions: [],
      status: "ready",
      error: null,
    });

    render(<WarehouseOverviewView />);
    expect(screen.getByText("Ração Premium")).toBeDefined();
    expect(screen.getByText("25 kg")).toBeDefined();
    expect(screen.getByText("LT-88")).toBeDefined();
    expect(screen.getByText("GCM Oliveira")).toBeDefined();
    expect(screen.getByText("Entrada")).toBeDefined();
  });
});
